import type { ReactNode } from "react";
import own from "./Voice.module.css";

/** A block of Réglages › Assistant vocal, in the Capri look: an eyebrow, a title, its rows. */
export function Block({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={own.block} data-row="">
      <p className={own.eyebrow}>{eyebrow}</p>
      <h3 className={own.title}>{title}</h3>
      {children}
    </section>
  );
}
