import "server-only";
export { inspectOpenAiConfig, readOpenAiRuntimeConfig, type OpenAiConfigStatus, type OpenAiRuntimeConfig } from "./config-values";
import { getOpenAiRuntimeConfigFromEnvironment } from "./config-values";
export const getOpenAiRuntimeConfig = getOpenAiRuntimeConfigFromEnvironment;
