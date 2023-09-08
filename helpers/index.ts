import config from 'config';
import i18n from '@vue-storefront/i18n';
import { unescape } from 'html-escaper';
import { htmlDecode } from '@vue-storefront/core/filters/html-decode';
import { price } from '@vue-storefront/core/filters';
import { currentStoreView, localizedRoute, removeStoreCodeFromRoute } from '@vue-storefront/core/lib/multistore';
import { formatCategoryLink } from '@vue-storefront/core/modules/url/helpers';
import rootStore from '@vue-storefront/core/store';

const HTMLParser = require('node-html-parser');

export function uniqId (prefix = '', includeRandom = false) {
  const timestamp = (Date.now() / 1000).toString(16).replace('.', '');

  if (!includeRandom) {
    return prefix + timestamp.padEnd(14, '0');
  }

  const randomPart = Math.floor(Math.random() * 100000000).toString();
  return prefix + timestamp + randomPart;
}

export function checkI18N (string: string, status = false) {
  const trimmedString = string.trim();
  const i18nMessage = i18n.messages[i18n.locale][trimmedString];
  if (status && i18nMessage) {
    return i18n.t(trimmedString);
  }
  return i18nMessage || string;
}

export function getPathForStaticPage (path: string) {
  const { storeCode } = currentStoreView();
  const isDefaultStore = storeCode === config.defaultStoreCode;

  return isDefaultStore ? `/i${path}` : path;
}

export function parseUrl (url) {
  if (/^(mailto:|tel:)/.test(url)) {
    return url;
  }

  const adminPath = 'admin'; // Edit this if the admin path has changed
  const paramsIndex = url.indexOf('?');
  const params = paramsIndex !== -1 ? `?${url.substring(paramsIndex + 1)}` : '';

  const baseUrls = [
    config.images.baseUrlAdmin.replace(/\/$/, ''),
    config.images.baseUrlCatalog.replace(/\/$/, '')
  ];

  const localePaths = ['/ru/', 'ru/', '/ua/', 'ua/'];
  const adminPathRegex = `\\/${adminPath}|(/(index|key)(?=/).*$)`;

  baseUrls.forEach((baseUrl) => {
    url = url.replace(new RegExp(`^${baseUrl}`), '');
  });

  localePaths.forEach((localePath) => {
    url = url.replace(new RegExp(localePath), '');
  });

  if (url.includes(`/${adminPath}/`)) {
    url = url.replace(new RegExp(adminPathRegex), '');
  }

  url = url.replace(/(^\/+|\/+$)/g, '');

  if (/^(https?:\/\/|www\.)/.test(url)) {
    return url;
  }

  const cmsPages = rootStore.getters['homepage/getCmsPages'];
  const matchedPage = cmsPages.find((page) => page.identifier.includes(url));

  if (matchedPage) {
    url = localizedRoute(getPathForStaticPage(`/${url}`));
  } else {
    url = url.split('?')[0];
    const categories = rootStore.getters['category/getCategories'];
    const matchedCategory = categories.find((cat) => cat.slug === url || String(cat.url_path) === url);
    if (matchedCategory) {
      url = formatCategoryLink(matchedCategory) + params;
    } else {
      const posts = rootStore.getters['themePosts/getPosts'];
      const matchedPost = posts.find((post) => post.url_key === url.replace('.html', ''));

      if (matchedPost) {
        url = localizedRoute(`/news/${matchedPost.url_key}`);
      } else {
        url = localizedRoute(url);
      }
    }
  }

  return url.startsWith('/') ? url : `/${url}`;
}

function formatSlug (slug) {
  slug = removeStoreCodeFromRoute(parseUrl(slug));
  slug = String(slug).replace('.html', '');
  return slug.startsWith('/') ? slug : `/${slug}`;
}

export function getProducts (parseContent) {
  parseContent.querySelectorAll('.product-item-info').forEach(item => {
    let sku = '';
    item.querySelectorAll('[data-role="tocart-form"]').forEach(form => {
      sku += form.getAttribute('data-product-sku');
    });
    if (sku) {
      item.querySelectorAll('a').forEach(link => {
        const slug = formatSlug(link.getAttribute('href'));
        link.setAttribute('href', `/p/${sku}${slug}`);
      });
    }
  });
}

export function mobileStyles (element, breakpoint = '768px') {
  if (!element.length) return;
  element.forEach(item => {
    let classUniqId = uniqId('mobile-style-', true);
    let styleNode = document.createElement('style');
    let wrapper = item.querySelectorAll('[data-element="wrapper"]');
    let dataStyles = '';
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
    let discountClass = `${Object.keys(loop(json, 'components')[0])[0]}-percent`;
    let percent = Math.round(100 - ((100 / oldPrice[0].config.value) * getPriceWithDiscount(specialPrice[0].config, personalDiscount)));
    let percentTemp = '<span class="percent ' + discountClass + '" data-price-type="percent">\n' +
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
  parseContent.querySelectorAll('a').forEach(item => {
    const href = item.getAttribute('href');
    const rel = item.getAttribute('rel');

    if (href && !href.startsWith('#')) {
      item.setAttribute('href', parseUrl(href));
      item.setAttribute('data-not-internal-link', 'true');
    }

    if (href && href.startsWith('http') && !rel) {
      item.setAttribute('rel', 'noopener');
    }
  });
}

// Helper function to create the label container HTML
function createLabelContainer (templateLeft, templateRight) {
  const labelContainer = HTMLParser.parse('<div class="product-labels-container"></div>');

  if (templateLeft.length > 0) {
    const leftWrapper = HTMLParser.parse('<div class="wrapper-left"></div>');
    leftWrapper.set_content(templateLeft.join(''));
    labelContainer.appendChild(leftWrapper);
  }

  if (templateRight.length > 0) {
    const rightWrapper = HTMLParser.parse('<div class="wrapper-right"></div>');
    rightWrapper.set_content(templateRight.join(''));
    labelContainer.appendChild(rightWrapper);
  }

  return labelContainer;
}

// Helper function to replace inner HTML using node-html-parser
function replaceInnerHtml (element, newHtml) {
  element.appendChild(newHtml.toString());
}

export function prepareLabels (parseContent) {
  parseContent.querySelectorAll('.product-item-photo').forEach(item => {
    const labelContainers = item.querySelectorAll('.amasty-label-container');
    const templateLeft = [];
    const templateRight = [];

    labelContainers.forEach(label => {
      const dataMageInit = label.getAttribute('data-mage-init');
      if (dataMageInit) {
        const init = JSON.parse(dataMageInit);
        const initJson = init[Object.keys(init)[0]];

        // Check if the label should be placed on the left
        if (initJson.config.position.includes('left')) {
          templateLeft.push(label.outerHTML);
        } else {
          templateRight.push(label.outerHTML);
        }
      }
    });
    item.removeChild('.amasty-label-container');

    // Create a custom HTML structure for labels
    const labelContainer = createLabelContainer(templateLeft, templateRight);

    // Replace the item's inner HTML with the label container
    replaceInnerHtml(item, labelContainer);
  });
}

function parseQueryString (queryString) {
  const params = {};
  if (!queryString) {
    return params;
  }

  const vars = queryString.split('&');
  for (const varPair of vars) {
    const [key, value] = varPair.split('=');
    if (key && value) {
      params[key] = value;
    }
  }
  return params;
}

function parseRawAttrs (rawAttrs) {
  const regex = new RegExp('(\\w+)=(?:"([^"]*)"|(\\S*))', 'g');
  let replaceAttrs = rawAttrs
    .replace(/\\/g, '')
    .replace(/"/g, '\'')
  // eslint-disable-next-line no-useless-escape
    .replace(/=\'/g, '="')
    .replace(/' /g, '" ')
    .replace(/(\s+)?.$/, '"');

  const obj = {};
  let match;
  while ((match = regex.exec(replaceAttrs)) !== null) {
    obj[match[1]] = match[2] ? match[2] : match[3];
  }
  return obj;
}

export function passPicturesThroughApiAndResize (url, screen = { width: '768', height: '768' }) {
  const uriArray = url.split('?');
  if (!new RegExp(config.images.baseMediaUrl, 'g').test(url)) {
    return url;
  }

  const params = parseQueryString(uriArray[1]);
  const width = params['width'] || (screen && screen.width) || '768';
  const height = params['height'] || (screen && screen.height) || '768';

  url = uriArray[0].replace(new RegExp(config.images.baseMediaUrl, 'g'), '');
  return `${config.images.baseUrl}${width}/${height}/resize${url}`;
}

export function attrBackgroundImages (element, className, value, breakpoint = '768px') {
  if (value) {
    const classUniqId = uniqId(`${className}-`);
    const classList = (element.getAttribute('class') || '') + ' ' + classUniqId;
    element.setAttribute('class', classList);

    const mediaQuery = className === 'mobile_image'
      ? `(max-width: ${breakpoint})`
      : `(min-width: calc(${breakpoint} + 1px))`;

    const styleNode = document.createElement('style');
    styleNode.textContent = `@media only screen and ${mediaQuery} { .${classUniqId} { background-image: url(${value})}}`;

    element.appendChild(styleNode);
  }
}

export function prepareImages (parseContent, screen = { width: '768', height: '768' }) {
  parseContent.querySelectorAll('picture source').forEach(item => {
    const srcset = item.getAttribute('srcset');
    item.setAttribute('srcset', config.images.dotBase64);
    item.setAttribute('data-srcset', passPicturesThroughApiAndResize(srcset, screen));
  });

  parseContent.querySelectorAll('img').forEach(item => {
    const src = item.getAttribute('src');
    const alt = item.getAttribute('alt');
    const classList = (item.getAttribute('class') || '') + ' lazyload';
    const imgPath = passPicturesThroughApiAndResize(src, screen);
    item.setAttribute('data-src', imgPath);
    item.setAttribute('data-sizes', 'auto');
    item.setAttribute('src', config.images.dotBase64);
    item.setAttribute('data-lazy', imgPath);
    item.setAttribute('loading', 'lazy');

    if (!alt) {
      item.setAttribute('alt', config.seo.defaultTitle);
    }
  });

  parseContent.querySelectorAll('.pagebuilder-banner-wrapper').forEach(item => {
    const rawAttrs = item.getAttribute('rawAttrs');
    if (rawAttrs) {
      const obj = parseRawAttrs(rawAttrs);
      if (obj['images']) {
        item.setAttribute('data-background-images', obj['images']);
        const jsonAttr = obj['images'].replace(/'/g, '"');
        ['mobile_image', 'desktop_image'].forEach(key => {
          attrBackgroundImages(item, key, JSON.parse(jsonAttr)[key]);
        });
      }
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

function processContent (content) {
  getProducts(content);
  preparePrice(content);
  prepareLinks(content);
  prepareLabels(content);
  // prepareImages(content); // Commented out for optimization
  prepareForm(content);
}

function unescapeAndReplaceText (cleanContent) {
  let unescapedContent = unescape(cleanContent);

  // Remove script tags from the unescaped content
  unescapedContent = unescapedContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  for (const selector of cleanContent.querySelectorAll('span, p, a, li, strong')) {
    if (selector.structuredText && checkI18N(selector.structuredText.trim(), true)) {
      const regex = new RegExp(selector.structuredText.trim(), 'g');
      unescapedContent = String(unescapedContent).replace(regex, String(checkI18N(selector.structuredText.trim())));
    }
  }

  for (const item of cleanContent.structuredText.split('\n')) {
    if (item && checkI18N(item.trim(), true)) {
      const regex = new RegExp(item.trim(), 'g');
      unescapedContent = String(unescapedContent).replace(regex, String(checkI18N(item.trim())));
    }
  }

  return unescapedContent;
}

export function parseHTML (HTML, identifier, screen = { width: '768', height: '768' }) {
  const start = new Date().getTime();
  let parseContent = HTMLParser.parse(htmlDecode(HTML));

  // Process the content
  processContent(parseContent);

  // Unescape and replace text using checkI18N
  parseContent = unescapeAndReplaceText(parseContent);

  const end = new Date().getTime();
  if (config.demomode) {
    console.log('Time of processing (parseHTML - ' + identifier + ') : ' + (end - start) + 'ms');
  }
  return parseContent;
}
