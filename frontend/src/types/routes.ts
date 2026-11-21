import type { FeatureContextPage } from "./features";

export type FeaturePage = FeatureContextPage;
export type ApplicationPage = FeaturePage | "login" | "signup";
