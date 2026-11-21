import type { Contact } from "@/types/contact";
/** Contact directory; municipal contact entries explicitly remain examples. */
export const CONTACT: Record<string, Contact> = {
  build: {
    name: "성동구청 건축과",
    phone: "02-2286-5114",
    ex: true,
  },
  hyg: {
    name: "성동구청 위생과",
    phone: "02-2286-5114",
    ex: true,
  },
  tax: {
    name: "국세상담센터",
    phone: "126",
    ex: false,
  },
  labor: {
    name: "고용노동부 상담센터",
    phone: "1350",
    ex: false,
  },
  gen: {
    name: "정부민원안내콜센터",
    phone: "110",
    ex: false,
  },
};

export const contactOfAgency: any = (a: any) =>
  /건축과/.test(a)
    ? CONTACT.build
    : /위생과/.test(a)
      ? CONTACT.hyg
      : /세무서|홈택스/.test(a)
        ? CONTACT.tax
        : /고용노동부/.test(a)
          ? CONTACT.labor
          : /구청/.test(a)
            ? CONTACT.build
            : null;
