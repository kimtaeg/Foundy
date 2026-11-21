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
  /** 영업장 면적(㎡). 입력하지 않으면 null */
  area: number | null;
  delivery: boolean;
  mainManual: string | null;
  onboarded: boolean;
}
