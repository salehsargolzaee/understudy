/** The app name lives here once. Every top rail renders <Brand />, so renaming
 *  the product is a one-line change and the rails can never drift apart. */
export const APP_NAME = "understudy";

export default function Brand() {
  return (
    <>
      <img src="/logo.svg" alt="" className="h-6 w-6 shrink-0" aria-hidden />
      <span className="hidden font-serif text-[15px] tracking-tight text-zinc-100 sm:block">{APP_NAME}</span>
    </>
  );
}
