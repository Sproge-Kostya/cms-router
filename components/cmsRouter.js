import config from 'config';
import reassignedRouter from '../reassigned-router';
import { parse } from 'node-html-parser';
import i18n from '@vue-storefront/i18n';
import { unescape } from 'html-escaper';
import { getPathForStaticPage } from 'theme/helpers';
import { formatCategoryLink } from '@vue-storefront/core/modules/url/helpers';
import { htmlDecode } from '@vue-storefront/core/filters/html-decode';
import { price } from '@vue-storefront/core/filters';
import { mapGetters } from 'vuex';

export default {
  mounted () {
    this.getPagesCollection = this.getCmsPages;
  },
  data () {
    return {
      getPagesCollection: []
    };
  },
  computed: {
    ...mapGetters({
      getCategories: 'category/getCategories',
      getCmsPages: 'homepage/getCmsPages'
    })
  },
  methods: {
    parseHTML (parseHTML) {
      let htmlDecodeContent = htmlDecode(parseHTML);
      let parseContent = parse(htmlDecodeContent);
      parseContent.querySelectorAll('[type="text/x-magento-init"]').map(item => {
        this.parsePrice(item.parentNode, JSON.parse(item.rawText));
      });
      parseContent.querySelectorAll('a').map(item => {
        if (!item.getAttribute('href').startsWith('#')) {
          item.setAttribute('href', this.parseUrl(item.getAttribute('href')));
        }
      });
      parseContent.querySelectorAll('picture source').map(item => {
        const srcset = item.getAttribute('srcset');
        item.setAttribute('srcset', config.images.dotBase64);
        item.setAttribute('data-srcset', srcset);
      });
      parseContent.querySelectorAll('img').map(item => {
        const src = item.getAttribute('src');
        item.setAttribute('data-src', src);
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
          if (this.checkI18N(selector.structuredText.trim(), true)) {
            let regex = new RegExp(selector.structuredText.trim(), 'g');
            unescapeContent = unescapeContent.replace(regex, i18n.t(selector.structuredText.trim()));
          }
        }
      });
      parseContent.structuredText.split('\n').map(item => {
        if (item) {
          if (this.checkI18N(item.trim(), true)) {
            let regex = new RegExp(item.trim(), 'g');
            unescapeContent = unescapeContent.replace(regex, i18n.t(item.trim()));
          }
        }
      });
      return unescapeContent;
    },

    checkI18N (string, status = false) {
      if (status) {
        return i18n.messages[i18n.locale][string.trim()];
      }
      return i18n.messages[i18n.locale][string.trim()] ? i18n.t(String(string.trim())) : string;
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
          '        <span class="price-label">' + this.checkI18N(oldPriceConfig.label) + '</span>\n' +
          '        <span class="price-wrapper" id="' + oldPriceConfig.id + '" data-price-type="' + oldPriceConfig.priceType + '" data-price-amount="' + oldPriceConfig.priceAmount + '">' +
          '            <span class="price"">' + price(oldPriceConfig.value) + '</span>' +
          '        </span>\n' +
          '    </span>\n' +
          '</span>';
      }
      let specialPrice = loop(json, 'special-price');
      if (specialPrice.length) {
        let specialPriceConfig = specialPrice[0].config;
        template += '<span class="special-price">\n' +
          '    <span class="price-container price-final_price tax weee">\n' +
          '        <span class="price-label">' + this.checkI18N(specialPriceConfig.label) + '</span>\n' +
          '        <span class="price-wrapper" id="' + specialPriceConfig.id + '" data-price-type="' + specialPriceConfig.priceType + '" data-price-amount="' + specialPriceConfig.priceAmount + '">' +
          '            <span class="price"">' + price(specialPriceConfig.value) + '</span>' +
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

    parseUrl (url) {
      let newUrl = url;
      let checkType = false;

      if (url.indexOf(config.images.baseUrlCatalog) !== -1) {
        newUrl = url.replace(config.images.baseUrlCatalog, '');

        if (newUrl.indexOf('/admin') !== -1) {
          newUrl = newUrl.replace('/admin', '');

          if (newUrl.indexOf('/index') !== -1) {
            let from = newUrl.search('index');
            let to = newUrl.length;
            let tailUrl = newUrl.substring(from, to);
            newUrl = newUrl.replace(tailUrl, '');
          }

          if (newUrl.indexOf('/key') !== -1) {
            let from = newUrl.search('key');
            let to = newUrl.length;
            let tailUrl = newUrl.substring(from, to);
            newUrl = newUrl.replace(tailUrl, '');
          }
        }
        if (newUrl.indexOf('ru/') !== -1) {
          let from = newUrl.search('ru/');
          let to = newUrl.length;
          let tailUrl = newUrl.substring(from, to);
          newUrl = newUrl.replace(tailUrl, '');
        }
        if (newUrl.indexOf('ua/') !== -1) {
          let from = newUrl.search('ua/');
          let to = newUrl.length;
          let tailUrl = newUrl.substring(from, to);
          newUrl = newUrl.replace(tailUrl, '');
        }

        newUrl = newUrl.endsWith('/') ? newUrl.substring(0, newUrl.length - 1) : newUrl;
        newUrl = newUrl.startsWith('/') ? newUrl.slice(1) : newUrl;
        let y = 0;
        while (y < reassignedRouter.length) {
          if (reassignedRouter[y].assigned === newUrl) {
            newUrl = reassignedRouter[y].reassigned;
            checkType = true;
            break;
          }
          y = y + 1;
        }
      }
      if (!checkType) {
        let params = newUrl.indexOf('?') !== -1 ? `?${newUrl.split('?')[1]}` : '';
        newUrl = newUrl.indexOf('?') !== -1 ? newUrl.split('?')[0] : newUrl;
        let cat = this.getCategories.find(cat => cat.url_path.indexOf(newUrl) !== -1);
        if (cat) {
          newUrl = formatCategoryLink(cat);
          newUrl = newUrl + params;
        } else {
          let page = this.getPagesCollection.find(pag => pag.identifier.indexOf(newUrl) !== -1);
          if (page) {
            let pageUrl = newUrl.startsWith('/') ? newUrl : `/${newUrl}`;
            newUrl = getPathForStaticPage(pageUrl);
          }
        }
      }

      return newUrl;
    },

    uniqid (a = '', b = false) {
      let c = Date.now() / 1000;
      let d = c.toString(16).split('.').join('');
      while (d.length < 14) {
        d += '0';
      }
      let e = '';
      if (b) {
        e = '.';
        let n = Math.floor(Math.random() * 11);
        let k = Math.floor(Math.random() * 100000000);
        let f = String.fromCharCode(n) + k;
        e += f;
      }
      return a + d + e;
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

    mobileStyles (element, breakpoint = '768px') {
      let $ = window.$;
      $.each(element, (key, item) => {
        let classUniqId = this.uniqid('mobile-style-');
        let styleNode = document.createElement('style');
        let wrapper = $(item).find('[data-element="wrapper"]');
        let dataStyles = '';

        styleNode.type = 'text/css';
        wrapper.addClass(classUniqId);

        $.each($(item).data(), (key, value) => {
          if (key.substring(0, 'mobileStyle'.length) === 'mobileStyle') {
            let styleCamel = key.substring('mobileStyle'.length, key.length);
            let styleKebab = styleCamel.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            let unit = isNaN(Number(value)) ? '' : 'px';
            if (!isNaN(value)) {
              dataStyles += String(styleKebab + ': ' + value + unit + '!important;');
            }
          }
        });
        styleNode.innerHTML = '@media only screen and (max-width: ' + breakpoint + ') { .' + classUniqId + ' {' + dataStyles + '} .' + classUniqId + ' .pagebuilder-overlay {min-height: auto !important;}}';
        wrapper.append(styleNode);
      });
    }
  }
};
