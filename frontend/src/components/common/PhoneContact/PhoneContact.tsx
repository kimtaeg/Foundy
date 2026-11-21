import { Element } from "@/components/view/Element";
import type { Contact } from "@/types/contact";

export type PhoneContactProps = { contact?: Contact };

export function PhoneContact({ contact }: PhoneContactProps) {
  if (!contact) return null;
  return (
    <Element className="nx-phone">
      <div>
        <b>📞 {contact.name}</b>
      </div>
      <Element className="nx-row">
        <Element as="span" className="nx-num">
          {contact.phone}
        </Element>
        <Element
          as="button"
          className="nx-btn outline slim"
          data-nx="copyphone"
          data-phone={contact.phone}
        >
          번호 복사
        </Element>
        <Element as="span" className={`nx-badge ${contact.ex ? "low" : "ok"}`}>
          {contact.ex ? "예시 번호 · 걸기 전 확인" : "공식 안내번호"}
        </Element>
      </Element>
    </Element>
  );
}
