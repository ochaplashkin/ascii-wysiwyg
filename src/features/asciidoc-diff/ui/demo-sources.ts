import originalSource from '../demo/original.adoc?raw';
import modifiedSource from '../demo/modified.adoc?raw';

import type { SourcePair } from './types.js';

export const DEMO_SOURCES: SourcePair = {
  left: { name: 'Демо: оригинал', text: originalSource },
  right: { name: 'Демо: изменённый', text: modifiedSource },
};
