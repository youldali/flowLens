import 'i18next';

import type codeAnalysisContextTranslations from '../public/locales/en/code-analysis-context.json';
import type commonTranslations from '../public/locales/en/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    strictKeyChecks: true;
    resources: {
      common: typeof commonTranslations;
      'code-analysis-context': typeof codeAnalysisContextTranslations;
    };
  }
}
