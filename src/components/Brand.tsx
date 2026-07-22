/** The app name lives here once. Every top rail renders <Brand />, so renaming
 *  the product is a one-line change and the rails can never drift apart. */
export const APP_NAME = "understudy";

export default function Brand() {
  return (
    <>
      <span className="h-4 w-4 shrink-0 rounded bg-accent" aria-hidden />
      <span className="hidden font-serif text-[15px] tracking-tight text-zinc-100 sm:block">{APP_NAME}</span>
    </>
  );
}
