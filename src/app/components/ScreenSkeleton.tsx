import type { ReactNode } from "react";

/**
 * Grey outlines shaped like a screen's real content, shown on its first load
 * instead of a full-page loader. The heading renders at once so the page is
 * named (and focusable) immediately; the outlines appear only after 200ms.
 */

const Block = ({ w, h = 14 }: { w: string; h?: number }) => (
  <span className="skeleton-block" style={{ width: w, height: h }} />
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">{children}</div>
);

const Row = ({ right = "6rem" }: { right?: string | null }) => (
  <div className="flex min-h-13 items-center gap-3 border-b border-border py-2 last:border-0">
    <div className="flex flex-1 flex-col gap-1.5">
      <Block w="55%" />
      <Block w="35%" h={12} />
    </div>
    {right && <Block w={right} h={40} />}
  </div>
);

const SHAPES: Record<"home" | "assets" | "plan" | "budgets", ReactNode> = {
  home: (
    <>
      <Card>
        <Block w="30%" h={12} />
        <Block w="60%" h={36} />
        <Block w="50%" />
      </Card>
      <Card>
        <Block w="30%" h={18} />
        <Block w="55%" h={30} />
        <Block w="100%" h={180} />
      </Card>
      <Card>
        <Block w="40%" h={18} />
        <Row right="5rem" />
        <Row right="5rem" />
        <Row right="5rem" />
      </Card>
    </>
  ),
  assets: (
    <>
      <Block w="100%" h={44} />
      {[2, 1, 1].map((rows, index) => (
        <Card key={index}>
          <Block w="40%" h={18} />
          {Array.from({ length: rows }, (_, row) => (
            <Row key={row} right="5rem" />
          ))}
        </Card>
      ))}
    </>
  ),
  plan: (
    <>
      <div className="flex items-center justify-between">
        <Block w="14rem" h={44} />
        <Block w="5.5rem" h={26} />
      </div>
      <Card>
        <Block w="25%" h={12} />
        <Block w="100%" />
        <Row right={null} />
        <Row right={null} />
      </Card>
      <Card>
        <Block w="30%" h={18} />
        <Row right="8rem" />
      </Card>
      <Card>
        <Block w="30%" h={18} />
        <Row right="8rem" />
        <Row right="8rem" />
        <Row right="8rem" />
      </Card>
    </>
  ),
  budgets: (
    <>
      <Block w="100%" h={44} />
      <Card>
        <Block w="100%" h={40} />
      </Card>
      {[0, 1].map((index) => (
        <Card key={index}>
          <Block w="45%" h={18} />
          <Block w="100%" h={10} />
          <Block w="60%" />
          <Block w="40%" h={44} />
        </Card>
      ))}
    </>
  ),
};

export function ScreenSkeleton({ title, shape }: { title: string; shape: keyof typeof SHAPES }) {
  return (
    <div className="screen-enter flex flex-col gap-5">
      <h1 tabIndex={-1} className="text-2xl font-semibold text-foreground focus:outline-none">
        {title}
      </h1>
      <div className="skeleton-delay flex flex-col gap-5" aria-hidden="true">
        {SHAPES[shape]}
      </div>
    </div>
  );
}
