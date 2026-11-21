import { Element } from "@/components/view/Element";

export function LoginBrand() {
  return (
    <div className="brand" style={{ margin: "0 auto 4px", padding: 0 }}>
      <Element as="span" className="wordmark">
        foundy
        <Element as="span" className="brand-period">
          .
        </Element>
      </Element>
    </div>
  );
}
