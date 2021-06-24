import { mobileStyles, parseHTML, parsePrice, attrBackgroundImages } from './helpers';

export const CmsRouter = {
  methods: {
    parseHTML (HTML, identifier, screen = { width: '768', height: '768' }) {
      return parseHTML(HTML, identifier, screen);
    },

    parsePrice (wrap, json) {
      return parsePrice(wrap, json);
    },

    attrBackgroundImages (element, className, value, breakpoint = '768px') {
      attrBackgroundImages(element, className, value, breakpoint);
    },

    mobileStyles (element, breakpoint) {
      mobileStyles(element, breakpoint);
    }
  }
};
