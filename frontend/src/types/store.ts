export interface Store {
  name: string;
  type: string;
  address: string;
  detail: string;
  opening: string;
  birth: number | null;
  location: "decided" | "undecided";
  region: string;
  alcohol: boolean;
  terrace: boolean;
  employees: boolean;
  funds: number | null;
  mainManual: string | null;
  onboarded: boolean;
}
