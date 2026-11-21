export interface Alert {
  id: string;
  type: string;
  title: string;
  body: string;
  ex?: boolean;
  cta: [string, string, string?];
}
