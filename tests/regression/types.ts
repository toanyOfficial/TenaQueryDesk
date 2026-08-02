export type GoldenScenario={id:string;question:string;role:string;requiredTools?:string[];alternativeTools?:string[][];forbiddenTools?:string[];requiredOrder?:string[];sqlMustBeReadonly?:boolean;executionExpected?:boolean;requiredReferences?:string[];forbiddenPatterns?:string[];requiredError?:string;maxIterations:number};
export type RegressionObservation={tools:string[];sql:string|null;answer:string;warnings:string[];iterations:number;executed:boolean;references:Record<string,unknown>;errors:string[]};
export type Evaluation={passed:boolean;failures:Array<{code:string;message:string}>};
