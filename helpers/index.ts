import config from 'config';
import i18n from '@vue-storefront/i18n';
import { formatCategoryLink } from '@vue-storefront/core/modules/url/helpers';
import { currentStoreView, localizedRoute } from '@vue-storefront/core/lib/multistore';
import rootStore from '@vue-storefront/core/store';

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

export function parseUrl (url) {
  let newUrl = url;
  const adminPath = 'admin'; // in case admin path has changed - edit this constant

  // ignore app links
  if (/^(mailto:|tel:)/.test(newUrl)) {
    return newUrl;
  }

  if (url.indexOf(config.images.baseUrlCatalog) !== -1) {
    const rules = [
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
    // remove slashes from start and end
    newUrl = newUrl.replace(/(^\/+|\/+$)/g, '');
  }
  let page = rootStore.getters['homepage/getCmsPages'].find(pag => pag.identifier.indexOf(newUrl) !== -1);
  if (page) {
    let pageUrl = newUrl.startsWith('/') ? newUrl : `/${newUrl}`;
    newUrl = getPathForStaticPage(pageUrl);
  } else {
    let params = newUrl.indexOf('?') !== -1 ? `?${newUrl.split('?')[1]}` : '';
    newUrl = newUrl.indexOf('?') !== -1 ? newUrl.split('?')[0] : newUrl;
    let cat = rootStore.getters['category/getCategories'].find(cat => cat.slug === newUrl || cat.url_path === newUrl);
    if (cat) {
      newUrl = formatCategoryLink(cat);
      newUrl = newUrl + params;
    } else {
      newUrl = localizedRoute(newUrl);
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

export function passPicturesThroughApiAndResize (url, screen) {
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
