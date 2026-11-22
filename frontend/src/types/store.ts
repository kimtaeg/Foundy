export interface Store {
  name: string;
  type: string;
  address: string;
  detail: string;
  opening: string;
  birth: number | null;
  /** 영업장 면적(㎡). 모르면 null */
  area: number | null;
  location: "decided" | "undecided";
  region: string;
  alcohol: boolean;
  terrace: boolean;
  employees: boolean;
  funds: number | null;
  mainManual: string | null;
  onboarded: boolean;
}
