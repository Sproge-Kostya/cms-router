import config from 'config';
import i18n from '@vue-storefront/i18n';
import { unescape } from 'html-escaper';
import { htmlDecode } from '@vue-storefront/core/filters/html-decode';
import { price } from '@vue-storefront/core/filters';
import { currentStoreView, localizedRoute, removeStoreCodeFromRoute } from '@vue-storefront/core/lib/multistore';
import { formatCategoryLink } from '@vue-storefront/core/modules/url/helpers';
import rootStore from '@vue-storefront/core/store';
const HTMLParser = require('node-html-parser');

export function uniqId (a = '', b = false) {
  let c = Date.now() / 1000;
  let d = c.toString(16).split('.').join('');
  while (d.length < 14) {
    d += '0';
  }
  let e = '';
  if (b) {
    let k = Math.floor(Math.random() * 100000000);
    e += k;
  }
  return a + d + e;
}

export function checkI18N (string, status = false) {
  if (status) {
    return i18n.messages[i18n.locale][string.trim()];
  }
  return i18n.messages[i18n.locale][string.trim()] ? i18n.t(String(string.trim())) : string;
}

export function getPathForStaticPage (path: string) {
  const { storeCode } = currentStoreView()
  const isStoreCodeEquals = storeCode === config.defaultStoreCode
  return isStoreCodeEquals ? `/i${path}` : path
}

export function getProducts (parseContent) {
  parseContent.querySelectorAll('.product-item-info').map(item => {
    let sku = '';
    item.querySelectorAll('[data-role="tocart-form"]').map(form => {
      sku += form.getAttribute('data-product-sku');
    });
    if (sku) {
      item.querySelectorAll('a').map(link => {
        let slug = removeStoreCodeFromRoute(parseUrl(link.getAttribute('href')));
        slug = String(slug).replace('.html', '');
        slug = slug.startsWith('/') ? slug : `/${slug}`;
        link.setAttribute('href', `/p/${sku}${slug}`);
      })
    }
  });
}

export function parseUrl (url) {
  let newUrl = url;
  const adminPath = 'admin'; // in case admin path has changed - edit this constant
  let params = newUrl.indexOf('?') !== -1 ? `?${newUrl.split('?')[1]}` : '';
  // ignore app links
  if (/^(mailto:|tel:)/.test(newUrl)) {
    return newUrl;
  }

  if (url.indexOf(config.images.baseUrlCatalog) !== -1 || url.indexOf(config.images.baseUrlAdmin) !== -1) {
    const rules = [
      // match catalog base url or admin url
      config.images.baseUrlAdmin.replace(/(\/$|$)/, '(?=/)'),
      // match catalog base url or admin url
      config.images.baseUrlCatalog.replace(/(\/$|$)/, '(?=/)'),
      // match locale paths
      '/ru/|/ua/'
    ];

    // match /index or /key till the EOL if it's admin url
    if (newUrl.includes(`/${adminPath}/`)) {
      rules.push(`/${adminPath}|(/index(?=/).*$|/key(?=/).*$)`);
    }

    newUrl = url.replace(new RegExp(`(${rules.join('|')})`, 'g'), '');
  }
  // remove slashes from start and end
  newUrl = removeStoreCodeFromRoute(newUrl.replace(/(^\/+|\/+$)/gm, '').trim());

  if (new RegExp('^(https://|http://|www.)').test(newUrl)) {
    return newUrl
  }
  let page = rootStore.getters['homepage/getCmsPages'].find(pag => pag.identifier.indexOf(newUrl) !== -1);
  if (page) {
    let pageUrl = newUrl.startsWith('/') ? newUrl : `/${newUrl}`;
    newUrl = localizedRoute(getPathForStaticPage(pageUrl));
  } else {
    newUrl = newUrl.indexOf('?') !== -1 ? newUrl.split('?')[0] : newUrl;
    let cat = rootStore.getters['category/getCategories'].find(cat => {
      return cat.slug === newUrl || String(cat.url_path) === newUrl
    });
    if (cat) {
      newUrl = formatCategoryLink(cat);
      newUrl = newUrl + params;
    } else {
      let post = rootStore.getters['themePosts/getPosts'].find(pag => pag.url_key === newUrl.replace('.html', ''));
      if (post) {
        newUrl = localizedRoute('/news/' + post.url_key)
      } else {
        newUrl = localizedRoute(newUrl);
      }
    }
  }
  newUrl = newUrl.startsWith('/') ? newUrl : `/${newUrl}`;
  return newUrl;
}

export function mobileStyles (element, breakpoint = '768px') {
  if (!element.length) return;
  element.forEach(item => {
    let classUniqId = uniqId('mobile-style-', true);
    let styleNode = document.createElement('style');
    let wrapper = item.querySelectorAll('[data-element="wrapper"]');
    let dataStyles = '';
    styleNode.type = 'text/css';
    wrapper[0].classList.add(classUniqId);
    Object.entries(item.dataset).map(item => {
      if (item[0].substring(0, 'mobileStyle'.length) === 'mobileStyle') {
        let styleCamel = item[0].substring('mobileStyle'.length, item[0].length);
        let styleKebab = styleCamel.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        let unit = isNaN(Number(item[1])) ? '' : 'px';
        if (item[1]) {
          dataStyles += `${styleKebab}:${item[1] + unit}!important;`;
        }
      }
    });
    styleNode.innerHTML = '@media only screen and (max-width: ' + breakpoint + ') { ' +
    dataStyles ? '.' + classUniqId + ' {' + dataStyles + '} ' : '' +
      '.' + classUniqId + ' .pagebuilder-overlay { min-height: auto !important; }' +
      '}';
    wrapper[0].append(styleNode);
  });
}

export function passPicturesThroughApiAndResize (url, screen = { width: '768', height: '768' }) {
  const uriArray = url.split('?') || [];
  let params = {};
  if (new RegExp(config.images.baseMediaUrl, 'g').test(url)) {
    if (uriArray.length === 2) {
      let vars = uriArray[1].split('&');
      let tmp = '';
      params = vars.reduce((accum, v) => {
        tmp = v.split('=');
        if (tmp.length === 2) {
          params[tmp[0]] = tmp[1];
        }
        return params;
      }, {});
      if (params) {
        if (params['width'] && params['height']) {
          url = uriArray[0].replace(new RegExp(config.images.baseMediaUrl, 'g'), '');
          url = `${config.images.baseUrl}${params['width']}/${params['height']}/resize${url}`;
        }
      }
    } else if (screen && screen.width) {
      url = uriArray[0].replace(new RegExp(config.images.baseMediaUrl, 'g'), '');
      url = `${config.images.baseUrl}${screen.width}/${screen.width}/resize${url}`;
    } else {
      url = uriArray[0].replace(new RegExp(config.images.baseMediaUrl, 'g'), '');
      url = `${config.images.baseUrl}768/768/resize${url}`;
    }
  }
  return url;
}

export function attrBackgroundImages (element, className, value, breakpoint = '768px') {
  if (value) {
    let classUniqId = uniqId(`${className}-`);
    let styleNode = '';
    let classList = element.attributes.class ? element.attributes.class + ' ' + classUniqId : classUniqId;
    element.setAttribute('class', classList);
    switch (className) {
      case 'mobile_image':
        styleNode = '<style> @media only screen and (max-width: ' + breakpoint + ') { .' + classUniqId + ' { background-image: url(' + value + ')}}</style>';
        break;
      case 'desktop_image':
        styleNode = '<style>@media only screen and (min-width: (' + breakpoint + ' + 1)) { .' + classUniqId + ' { background-image: url(' + value + ')}}</style>';
        break;
      default:
    }
    element.set_content(styleNode);
  }
}

export function parsePrice (wrap, json) {
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
  const getPriceWithDiscount = (price, discount = 0) => {
    let sumDiscount = (Number(price.value) / 100) * Number(discount);
    return Number(price.value) - sumDiscount
  };
  let loyaltyCart = rootStore.getters['themeCustomer/getLoyaltyCart'];
  let personalDiscount = 0;
  if (loyaltyCart) {
    personalDiscount = loyaltyCart.discount;
  }
  if (specialPrice.length) {
    let specialPriceConfig = specialPrice[0].config;
    template += '<span class="special-price">\n' +
      '    <span class="price-container price-final_price tax weee">\n' +
      '        <span class="price-label">' + checkI18N(specialPriceConfig.label) + '</span>\n' +
      '        <span class="price-wrapper" id="' + specialPriceConfig.id + '" data-price-type="' + specialPriceConfig.priceType + '" data-price-amount="' + specialPriceConfig.priceAmount + '">' +
      '            <span class="price">' + price(getPriceWithDiscount(specialPriceConfig, personalDiscount)) + '</span>' +
      '        </span>\n' +
      '    </span>\n' +
      '</span>';
  }
  if (specialPrice.length && oldPrice.length) {
    let percent = Math.round(100 - ((100 / oldPrice[0].config.value) * getPriceWithDiscount(specialPrice[0].config, personalDiscount)));
    let percentTemp = '<span class="percent" data-price-type="percent">\n' +
      '        <span> -' + percent + '%</span>\n' +
      '    </span>';
    bind.set_content(percentTemp + template);
  } else {
    bind.set_content(template);
  }
}

export function preparePrice (parseContent) {
  return parseContent.querySelectorAll('[type="text/x-magento-init"]').map(item => parsePrice(item.parentNode, JSON.parse(item.rawText)));
}

export function prepareLinks (parseContent) {
  return parseContent.querySelectorAll('a').map(item => {
    const { href, rel } = item.attributes;
    if (!href.startsWith('#')) {
      item.setAttribute('href', parseUrl(href));
    }
    // add rel='noopener'
    if (/(http[s]?:\/\/)/.test(href) && !rel) {
      item.setAttribute('rel', 'noopener');
    }
  });
}

export function prepareLabels (parseContent) {
  return parseContent.querySelectorAll('.product-item-photo').map(item => {
    let templateLeft = '';
    let templateRight = '';
    item.querySelectorAll('.amasty-label-container').map(label => {
      const dataMageInit = label.getAttribute('data-mage-init');
      if (dataMageInit) {
        const init = JSON.parse(dataMageInit);
        const initJson = init[Object.keys(init)[0]];
        if (initJson.config.position.search('left') !== -1) {
          templateLeft += label.toString();
        } else {
          templateRight += label.toString();
        }
      }
    });
    item.appendChild(`<div class="product-labels-container"><div class="wrapper-left">${templateLeft}</div><div class="wrapper-right">${templateRight}</div></div>`);
  });
}

export function prepareImages (parseContent, screen = { width: '768', height: '768' }) {
  parseContent.querySelectorAll('picture source').map(item => {
    const { srcset } = item.attributes;
    item.setAttribute('srcset', config.images.dotBase64);
    item.setAttribute('data-srcset', passPicturesThroughApiAndResize(srcset, screen));
  });
  parseContent.querySelectorAll('img').map(item => {
    const classList = item.attributes.class ? item.attributes.class + ' lazyload' : 'lazyload';
    const { src, alt } = item.attributes;
    const imgPath = passPicturesThroughApiAndResize(src, screen);
    item.setAttribute('data-src', imgPath);
    item.setAttribute('data-sizes', 'auto');
    item.setAttribute('src', config.images.dotBase64);
    item.setAttribute('data-lazy', imgPath);
    item.setAttribute('loading', 'lazy');
    item.setAttribute('class', classList);
    if (!alt) {
      item.setAttribute('alt', config.seo.defaultTitle);
    }
  });
  parseContent.querySelectorAll('.pagebuilder-banner-wrapper').map(item => {
    if (item['rawAttrs']) {
      let regex = new RegExp('(\\w+)=(?:"([^"]*)"|(\\S*))', 'g');
      let replaceAttrs = item['rawAttrs'].replace(new RegExp(/\\/, 'g'), '').replace(new RegExp('"', 'g'), '\'').replace(new RegExp('=\'', 'g'), '="').replace(new RegExp('\' ', 'g'), '" ').replace(/(\s+)?.$/, '"');
      let obj = {};
      let m;
      while ((m = regex.exec(replaceAttrs)) !== null) {
        if (m[2]) {
          obj[m[1]] = m[2];
        } else {
          obj[m[1]] = m[3];
        }
      }
      if (obj['images']) {
        item.setAttribute('data-background-images', String(obj['images']));
      }

      let jsonAttr = String(obj['images']).replace(new RegExp("'", 'g'), '"');
      const attr = ['mobile_image', 'desktop_image'];
      attr.map(key => {
        attrBackgroundImages(item, key, JSON.parse(jsonAttr)[key]);
      });
    }
  });
  return parseContent;
}

export function prepareForm (parseContent) {
  return parseContent.querySelectorAll('form').map(item => {
    item.removeAttribute('action');
    item.removeAttribute('method');
    item.querySelectorAll('[type=submit]').map(button => {
      button.setAttribute('class', 'sf-button sf-button--full-width form__action-button--secondary');
    })
  });
}

export function parseHTML (HTML, identifier, screen = { width: '768', height: '768' }) {
  const start = new Date().getTime();
  let parseContent = HTMLParser.parse(htmlDecode(HTML));
  getProducts(parseContent);
  // init price render
  preparePrice(parseContent);
  // parse all links
  prepareLinks(parseContent);
  // parse all labels
  prepareLabels(parseContent);
  // parse all images
  prepareImages(parseContent, screen);
  // parse all form
  prepareForm(parseContent);

  let unescapeContent = unescape(parseContent);
  parseContent.querySelectorAll('span, p, a, li, strong').map(selector => {
    if (selector.structuredText) {
      if (checkI18N(selector.structuredText.trim(), true)) {
        let regex = new RegExp(selector.structuredText.trim(), 'g');
        unescapeContent = unescapeContent.replace(regex, checkI18N(selector.structuredText.trim()));
      }
    }
  });
  parseContent.structuredText.split('\n').map(item => {
    if (item) {
      if (checkI18N(item.trim(), true)) {
        let regex = new RegExp(item.trim(), 'g');
        unescapeContent = unescapeContent.replace(regex, checkI18N(item.trim()));
      }
    }
  });
  const end = new Date().getTime();
  console.log('Time of processing (parseHTML - ' + identifier + ') : ' + (end - start) + 'ms');
  return unescapeContent;
}
