import config from 'config';
import reassignedRouter from '../reassigned-router';
import { parse } from 'node-html-parser';
import i18n from '@vue-storefront/i18n';
import { unescape } from 'html-escaper';
import { getPathForStaticPage } from 'theme/helpers';
import { formatCategoryLink } from '@vue-storefront/core/modules/url/helpers';
import { localizedRoute } from '@vue-storefront/core/lib/multistore';
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
      let unescapeContent = unescape(parseContent);
      parseContent.structuredText.split('\n').map(item => {
        if (item) {
          if (i18n.messages[i18n.locale][item]) {
            let regex = new RegExp(item, 'g');
            unescapeContent = unescapeContent.replace(regex, i18n.t(item));
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
          '        <span class="price-label">' + i18n.t(oldPriceConfig.label) + '</span>\n' +
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
          '        <span class="price-label">' + i18n.t(specialPriceConfig.label) + '</span>\n' +
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

      return localizedRoute(newUrl);
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
