import config from 'config';
import { parse } from 'node-html-parser';
import i18n from '@vue-storefront/i18n';
import { unescape } from 'html-escaper';
import { htmlDecode } from '@vue-storefront/core/filters/html-decode';
import { price } from '@vue-storefront/core/filters';
import { checkI18N, mobileStyles, parseUrl, passPicturesThroughApiAndResize } from './helpers';
import { localizedRoute } from '@vue-storefront/core/lib/multistore';

export const CmsRouter = {
  methods: {
    parseHTML (parseHTML) {
      let htmlDecodeContent = htmlDecode(parseHTML);
      let parseContent = parse(htmlDecodeContent);
      parseContent.querySelectorAll('[type="text/x-magento-init"]').map(item => {
        this.parsePrice(item.parentNode, JSON.parse(item.rawText));
      });
      parseContent.querySelectorAll('a').map(item => {
        if (!item.getAttribute('href').startsWith('#')) {
          item.setAttribute('href', localizedRoute(parseUrl(item.getAttribute('href'))));
        }
        // add rel='noopener'
        if (/(http[s]?:\/\/)/.test(item.getAttribute('href'))) {
          item.setAttribute('rel', 'noopener');
        }
      });
      parseContent.querySelectorAll('picture source').map(item => {
        const srcset = item.getAttribute('srcset');
        item.setAttribute('srcset', config.images.dotBase64);
        item.setAttribute('data-srcset', passPicturesThroughApiAndResize(srcset));
      });
      parseContent.querySelectorAll('img').map(item => {
        let src = item.getAttribute('src');
        item.setAttribute('data-src', passPicturesThroughApiAndResize(src));
        item.setAttribute('data-sizes', 'auto');
        item.setAttribute('src', config.images.dotBase64);
        item.setAttribute('loading', 'lazy');
        const classList = item.getAttribute('class');
        item.setAttribute('class', classList ? classList + ' lazyload' : ' lazyload');
        const alt = item.getAttribute('alt');
        if (!alt) {
          item.setAttribute('alt', config.seo.defaultTitle);
        }
      });
      parseContent.querySelectorAll('form [type=submit]').map(item => {
        item.setAttribute('class', 'sf-button sf-button--full-width form__action-button--secondary');
      });
      parseContent.querySelectorAll('.pagebuilder-banner-wrapper').map(item => {
        if (item.rawAttrs) {
          let regex = new RegExp('(\\w+)=(?:"([^"]*)"|(\\S*))', 'g');
          let replaceAttrs = item.rawAttrs.replace(new RegExp(/\\/, 'g'), '').replace(new RegExp('"', 'g'), '\'').replace(new RegExp('=\'', 'g'), '="').replace(new RegExp('\' ', 'g'), '" ').replace(/(\s+)?.$/, '"');
          let obj = {};
          let m;
          while ((m = regex.exec(replaceAttrs)) !== null) {
            if (m[2]) {
              obj[m[1]] = m[2];
            } else {
              obj[m[1]] = m[3];
            }
          }
          if (obj.images) {
            item.setAttribute('data-background-images', String(obj.images));
          }

          let jsonAttr = String(obj.images).replace(new RegExp("'", 'g'), '"');
          const attr = ['mobile_image', 'desktop_image'];
          attr.map(key => {
            this.attrBackgroundImages(item, key, JSON.parse(jsonAttr)[key]);
          });
        }
      });
      let unescapeContent = unescape(parseContent);
      parseContent.querySelectorAll('form').map(form => {
        if (form.rawAttrs) {
          let regex = new RegExp(form.rawAttrs, 'g');
          unescapeContent = unescapeContent.replace(regex, '');
        }
      });
      parseContent.querySelectorAll('span, p, a, li, strong').map(selector => {
        if (selector.structuredText) {
          if (checkI18N(selector.structuredText.trim(), true)) {
            let regex = new RegExp(selector.structuredText.trim(), 'g');
            unescapeContent = unescapeContent.replace(regex, i18n.t(selector.structuredText.trim()));
          }
        }
      });
      parseContent.structuredText.split('\n').map(item => {
        if (item) {
          if (checkI18N(item.trim(), true)) {
            let regex = new RegExp(item.trim(), 'g');
            unescapeContent = unescapeContent.replace(regex, i18n.t(item.trim()));
          }
        }
      });
      return unescapeContent;
    },

    parsePrice (wrap, json) {
      let loop = (item, key, array = []) => {
        if (Object.keys(item).map(i => String(i) === key).indexOf(true) === -1 && typeof item === 'object') {
          Object.keys(item).map(i => {
            loop(item[i], key, array);
          });
        } else {
          if (item[key]) {
            array.push(item[key]);
          }
        }
        return array;
      };
      let bind = wrap.querySelector('span');
      let template = '';
      let oldPrice = loop(json, 'old-price');
      if (oldPrice.length) {
        let oldPriceConfig = oldPrice[0].config;
        template += '<span class="old-price">\n' +
          '    <span class="price-container price-final_price tax weee">\n' +
          '        <span class="price-label">' + checkI18N(oldPriceConfig.label) + '</span>\n' +
          '        <span class="price-wrapper" id="' + oldPriceConfig.id + '" data-price-type="' + oldPriceConfig.priceType + '" data-price-amount="' + oldPriceConfig.priceAmount + '">' +
          '            <span class="price">' + price(oldPriceConfig.value) + '</span>' +
          '        </span>\n' +
          '    </span>\n' +
          '</span>';
      }
      let specialPrice = loop(json, 'special-price');
      if (specialPrice.length) {
        let specialPriceConfig = specialPrice[0].config;
        template += '<span class="special-price">\n' +
          '    <span class="price-container price-final_price tax weee">\n' +
          '        <span class="price-label">' + checkI18N(specialPriceConfig.label) + '</span>\n' +
          '        <span class="price-wrapper" id="' + specialPriceConfig.id + '" data-price-type="' + specialPriceConfig.priceType + '" data-price-amount="' + specialPriceConfig.priceAmount + '">' +
          '            <span class="price">' + price(specialPriceConfig.value) + '</span>' +
          '        </span>\n' +
          '    </span>\n' +
          '</span>';
      }
      if (specialPrice.length && oldPrice.length) {
        let percent = Math.round(100 - ((100 / oldPrice[0].config.value) * specialPrice[0].config.value));
        let percentTemp = '<span class="percent" data-price-type="percent">\n' +
          '        <span> -' + percent + '%</span>\n' +
          '    </span>';
        bind.set_content(percentTemp + template);
      } else {
        bind.set_content(template);
      }
    },

    attrBackgroundImages (element, className, value, breakpoint = '768px') {
      if (value) {
        let classUniqId = this.uniqid(`${className}-`);
        let styleNode = '';
        element.setAttribute('class', element.getAttribute('class') + ` ${classUniqId}`);
        switch (className) {
          case 'mobile_image':
            styleNode = '<style type="text/css"> @media only screen and (max-width: ' + breakpoint + ') { .' + classUniqId + ' { background-image: url(' + value + ')}}</style>';
            break;
          case 'desktop_image':
            styleNode = '<style type="text/css">@media only screen and (min-width: (' + breakpoint + ' + 1)) { .' + classUniqId + ' { background-image: url(' + value + ')}}</style>';
            break;
          default:
        }
        element.set_content(styleNode);
      }
    },

    mobileStyles (element, breakpoint) {
      mobileStyles(element, breakpoint);
    }
  }
};
