import {describe,expect,test} from "bun:test";
import {getFeatureFlags,isToolFeatureEnabled} from "./feature-flags";
describe("feature flag dependency policy",()=>{test("keeps actual model evaluation opt-in",()=>expect(getFeatureFlags({} as NodeJS.ProcessEnv).actualModelEvaluation).toBe(false));test("screenshot also requires the UI browser capability",()=>{const flags={...getFeatureFlags(),uiBrowser:false,uiScreenshot:true};expect(isToolFeatureEnabled("capture_ui_screenshot",flags)).toBe(false);});});
