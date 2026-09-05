/**
 * background/index.ts — Background service worker entry point.
 *
 * Responsibilities (see Architecture.md §2):
 *   - Message routing between popup and content script (Phase 3+)
 *   - LLM API calls (Phase 6)
 *   - Storage orchestration
 *
 * The content script is NOT statically injected via manifest content_scripts.
 * Instead it is injected on demand via chrome.scripting.executeScript() when
 * the user triggers a fill — keeping the host-permission footprint minimal.
 *
 * Phase 3 implementation.
 */

import { startMessageRouter } from './messageRouter'

startMessageRouter()
