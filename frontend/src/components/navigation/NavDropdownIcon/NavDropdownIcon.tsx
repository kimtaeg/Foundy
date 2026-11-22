import Image from "next/image";

export interface NavDropdownIconProps {
  destinationId: string;
}

const iconSources: Record<string, string> = {
  report: "/icons/navigation/report.svg",
  checklist: "/icons/navigation/checklist.svg",
  docs: "/icons/navigation/documents.svg",
};

export function NavDropdownIcon({ destinationId }: NavDropdownIconProps) {
  return (
    <Image
      src={iconSources[destinationId] ?? iconSources.report}
      alt=""
      aria-hidden="true"
      width={36}
      height={36}
      loading="eager"
      draggable={false}
      className="size-9 shrink-0 object-contain"
    />
  );
}
