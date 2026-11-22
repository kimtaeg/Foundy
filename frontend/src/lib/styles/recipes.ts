/** Shared Tailwind recipes for visual primitives. State markers are local to each element. */
const componentRecipes: Record<string, string> = {
  eyebrow:
    "text-xs text-neutral-600! font-extrabold mb-3! tracking-[.16em]! uppercase  hidden!",
  pagetitle:
    "font-extrabold! tracking-[-.045em]! text-[clamp(28px,4vw,40px)]! [margin:0_0_10px]! leading-[1.25]! text-[var(--ink)]! [font-family:'SUIT_Variable','SUIT',sans-serif]! [@media(max-width:550px)]:text-[22px] [@media(max-width:600px)]:text-[28px]! [@media(max-width:650px)]:text-[25px]",
  subtitle:
    "text-[var(--muted)]! text-base! m-0 leading-[1.6]! mt-4! [max-width:760px] [@media(max-width:650px)]:text-sm",
  headrow:
    "flex justify-between items-end! gap-7.5! [margin-bottom:29px] [margin:12px_0_28px]! [padding-bottom:27px]! [border-bottom:1px_solid_var(--line)]! [@media(max-width:550px)]:items-start [@media(max-width:600px)]:flex-wrap [@media(max-width:600px)]:items-start [@media(max-width:600px)]:block! [@media(max-width:600px)]:mb-6! [@media(max-width:650px)]:gap-3.5 [@media(max-width:600px)]:[&>.button]:mt-4.5",
  button:
    "border-0! [background:var(--tp)]! text-[#fff]! [padding:0_20px]! rounded-[14px]! font-bold! text-[15px]! inline-flex items-center gap-2 whitespace-nowrap min-h-11.5! shadow-none! tracking-[-.02em]! justify-center [transition:background_.15s,transform_.1s] [&:hover]:[filter:none]! [&:hover]:[background:var(--tp-d)]! [&:hover]:text-[#fff]! [&.secondary]:bg-neutral-200! [&.secondary]:text-neutral-600! [&.secondary]:[border:1px_solid_#d4d4d4]! [&.secondary]:[border-color:#e5e5e5] [&.secondary]:rounded-[9px] [&.pale]:[background:transparent]! [&.pale]:text-neutral-800! [&.pale]:rounded-[9px] [&.pale]:[border:1px_solid_#d4d4d4]! [&.slim]:[padding:8px_11px] [&.slim]:text-sm [&.primary]:rounded-[9px] [&.primary]:[background:var(--primary)] [&.secondary:hover]:bg-neutral-300! [&.secondary:hover]:text-[var(--ink)]! [&.pale:hover]:bg-neutral-100! [&.pale:hover]:text-[var(--ink)]!",
  smallmuted: "text-[var(--muted)]! text-sm leading-[1.72]!",
  "section-title":
    "text-[21px]! font-bold! m-0 text-neutral-800! tracking-[-.06em]! [&_.pill]:[vertical-align:middle]",
  panel:
    "bg-neutral-50! border-0! rounded-[var(--radius)]! p-0! min-w-0 [box-shadow:var(--shadow)]! overflow-visible! [@media(max-width:600px)]:p-4.5 [body_&]:[overflow-wrap:anywhere]",
  check:
    "[width:19px] [height:19px] [accent-color:var(--primary)]! cursor-pointer mt-0.5",
  due: "text-xs text-neutral-700! bg-neutral-100! [padding:6px_9px] rounded-none! whitespace-nowrap [&.normal]:text-neutral-700! [&.normal]:bg-neutral-100!",
  alert:
    "[padding:19px_0]! [border-bottom:1px_solid_var(--line)]! flex gap-2.5 [&:last-child]:border-0 [&_strong]:text-sm! [&_strong]:leading-[1.5] [&_strong]:block [&_strong]:font-[650]! [&_small]:block [&_small]:text-sm! [&_small]:text-[var(--muted)] [&_small]:[margin-top:5px]",
  source:
    "[padding:12px_14px] bg-neutral-100! border-0! rounded-none! text-sm text-neutral-600 mt-3 leading-[1.8] [border-left:2px_solid_#d4d4d4]! [&_strong]:text-neutral-600",
  filters: "flex gap-0! mb-4 flex-wrap [border-bottom:1px_solid_var(--line)]!",
  filter:
    "border-0! [background:transparent]! text-neutral-600! rounded-none! text-sm! font-[750] [padding:13px_22px]! [min-height:41px] [border-bottom:2px_solid_transparent]! [&.active]:[background:transparent]! [&.active]:[border-color:#e5e5e5] [&.active]:text-foundy-primary-ink! [&.active]:[border-bottom-color:#107e7d]!",
  timeline: "relative ml-3 [padding-left:25px] [border-left:2px_solid_#e5e5e5]",
  grant:
    "[border:1px_solid_var(--line)] rounded-[12px] p-5 bg-neutral-50 mb-3 [&_h3]:text-lg [&_h3]:leading-[1.6] [&_h3]:[margin:14px_0_9px] [&_p]:text-sm [&_p]:text-neutral-600 [&_p]:leading-[1.8] [&_.grant-foot]:flex [&_.grant-foot]:justify-between [&_.grant-foot]:items-center [&_.grant-foot]:mt-4 [&_.grant-foot]:text-sm [&_.grant-foot]:text-neutral-600",
  suggestions:
    "[&_button]:block [&_button]:w-full [&_button]:bg-neutral-50 [&_button]:[border:1px_solid_#f5f5f5] [&_button]:rounded-[10px] [&_button]:text-left [&_button]:[padding:13px] [&_button]:[margin:9px_0] [&_button]:text-neutral-600 [&_button]:text-sm [&_button]:leading-[1.6] [&_button]:min-h-11.5",
  message:
    "[max-width:78%] [padding:15px_17px] rounded-[15px] bg-neutral-50 text-neutral-600 leading-[1.9] text-sm [&.user]:[align-self:flex-end] [&.user]:[background:var(--primary)] [&.user]:text-[#fff] [&.assistant]:[align-self:flex-start]",
  register: "[max-width:770px] [margin:0_auto]",
  wizardsteps: "flex items-center gap-3 [margin-bottom:25px]",
  wizardstep:
    "text-sm text-neutral-600 flex items-center gap-2 font-bold [&_b]:grid [&_b]:place-items-center [&_b]:w-6 [&_b]:h-6 [&_b]:bg-neutral-100 [&_b]:rounded-full [&_b]:text-xs [&.active]:text-[var(--tp-d)]! [&.active_b]:[background:var(--tp)]! [&.active_b]:text-[white]",
  stepbar: "[height:1px] bg-neutral-200 flex-1",
  field:
    "flex flex-col gap-2 [&.full]:[grid-column:1/-1] [&_label]:text-sm [&_label]:font-extrabold [&_label]:text-neutral-600 [&_input]:w-full [&_input]:[border:1px_solid_#e5e5e5] [&_input]:rounded-[9px] [&_input]:[background:white] [&_input]:[padding:13px_14px] [&_input]:[outline:none] [&_input]:text-[var(--ink)] [&_input]:text-base [&_input]:[min-height:45px] [&_select]:w-full [&_select]:[border:1px_solid_#e5e5e5] [&_select]:rounded-[9px] [&_select]:[background:white] [&_select]:[padding:13px_14px] [&_select]:[outline:none] [&_select]:text-[var(--ink)] [&_select]:text-base [&_select]:[min-height:45px] [&_input:focus]:[border-color:var(--primary)] [&_select:focus]:[border-color:var(--primary)] [&_small]:text-sm [&_small]:text-neutral-600 [@media(max-width:550px)]:[&.full]:[grid-column:auto] [@media(max-width:600px)]:[&.full]:[grid-column:auto]",
  question:
    "[padding:17px_0] [border-bottom:1px_solid_var(--line)] [border-color:#f5f5f5]! [&_strong]:text-sm [&_small]:block [&_small]:text-neutral-600 [&_small]:text-sm [&_small]:mt-2 [&_small]:leading-[1.5]",
  options: "flex gap-2 mt-3 [@media(max-width:600px)]:flex-wrap",
  option:
    "[border:1px_solid_var(--line)] rounded-[8px] [background:#fff] [padding:10px_19px] text-neutral-600 text-sm font-extrabold cursor-pointer min-h-10.5 [&.selected]:text-[var(--tp-d)] [&.selected]:[border-color:#107e7d] [&.selected]:[background:var(--primary-soft)]",
  "analysis-list": "[margin:25px_0]",
  "analysis-item":
    "flex items-center [gap:13px] [padding:14px_0] [border-bottom:1px_solid_var(--line)] text-sm [&_.circle]:w-7 [&_.circle]:h-7 [&_.circle]:rounded-full [&_.circle]:bg-neutral-100 [&_.circle]:text-neutral-600 [&_.circle]:grid [&_.circle]:place-items-center [&.done_.circle]:[background:var(--green-bg)]! [&.done_.circle]:text-[var(--green)]! [&.running_.circle]:[background:var(--tp-soft)]! [&.running_.circle]:text-[var(--tp-d)]! [&_.status]:ml-auto [&_.status]:text-xs [&_.status]:text-neutral-600",
  modal:
    "bg-white! rounded-[28px]! [width:min(480px,100%)] p-8! [box-shadow:0_30px_80px_rgba(0,0,0,.25)]! [&_h2]:text-[20px] [&_h2]:[margin:0_0_9px] [&_p]:text-sm [&_p]:text-neutral-600 [&_p]:leading-[1.7]",
  "nx-wrap": "grid gap-4",
  "nx-stack": "grid gap-3",
  "nx-grid2": "grid grid-cols-2 gap-4 [@media(max-width:900px)]:grid-cols-1",
  "nx-cols3": "grid grid-cols-3 gap-3.5 [@media(max-width:900px)]:grid-cols-1",
  "nx-cols4":
    "grid grid-cols-4 gap-3 mb-3.5 [@media(max-width:900px)]:[grid-template-columns:repeat(2,1fr)]",
  "nx-card":
    "bg-neutral-50! border-0! rounded-[var(--radius)]! p-6.5! [box-shadow:var(--shadow)]! [&_h3]:text-[19px]! [&_h3]:[margin:4px_0_8px]! [&_h3]:leading-[1.5] [&_h3]:font-extrabold! [&_h3]:tracking-[-.035em]! [@media(max-width:600px)]:p-5! [&_.nx-muted]:text-[var(--muted)]!",
  "nx-muted": "text-[var(--muted)]! text-sm leading-[1.7]",
  "nx-kicker":
    "text-xs font-extrabold! text-[var(--tp-d)]! tracking-[.02em]!",
  "nx-banner":
    "bg-neutral-50! border-0! rounded-[var(--radius)]! [padding:26px_28px]! flex items-center justify-between gap-3.5 flex-wrap [box-shadow:var(--shadow)]! [&_h2]:font-extrabold! [&_h2]:tracking-[-.04em]! [&_h3]:font-extrabold! [&_h3]:tracking-[-.04em]!",
  "nx-note":
    "[background:var(--tp-soft2)]! border-0! [border-left:0]! rounded-[16px]! [padding:14px_18px]! text-sm leading-[1.7] text-neutral-600! [&_p]:[margin:4px_0]",
  "nx-badges": "flex flex-wrap items-center gap-2",
  "nx-badge":
    "rounded-full! [padding:5px_11px]! text-xs font-bold! bg-neutral-100! text-neutral-600! [&.high]:[background:var(--red-bg)]! [&.high]:text-[var(--red)]! [&.low]:[background:var(--amber-bg)]! [&.low]:text-[var(--amber)]! [&.unknown]:bg-neutral-100! [&.unknown]:text-neutral-600! [&.ok]:[background:var(--green-bg)]! [&.ok]:text-[var(--green)]!",
  "nx-btn":
    "border-0! [background:var(--tp)]! text-[#fff]! [padding:0_20px]! rounded-[14px]! font-bold! text-[15px]! min-h-11.5! cursor-pointer inline-flex items-center gap-1.5 no-underline whitespace-nowrap tracking-[-.02em]! shadow-none! [transition:background_.15s,transform_.1s] [&:hover]:[filter:none]! [&:hover]:[background:var(--tp-d)]! [&:disabled]:opacity-45! [&:disabled]:cursor-default [&.outline]:bg-neutral-200! [&.outline]:text-neutral-600! [&.outline]:[border:1px_solid_var(--line)] [&.ghost]:[background:transparent]! [&.ghost]:text-[var(--tp-d)]! [&.ghost]:[padding:0_8px]! [&.ghost]:min-h-9! [&.slim]:[padding:0_14px]! [&.slim]:text-sm! [&.slim]:min-h-9! [&.slim]:rounded-[11px]! [&:active]:[transform:scale(.98)] [&.outline:hover]:bg-neutral-300! [&.ghost:hover]:[background:var(--tp-soft)]! [a&]:no-underline",
  "nx-row": "flex flex-wrap gap-2 items-center",
  "nx-col": "grid gap-1.5 [justify-items:end]",
  "nx-heading": "flex items-center justify-between gap-2.5 flex-wrap mb-1.5",
  "nx-metric":
    "bg-neutral-50! border-0! rounded-[var(--radius)]! [padding:22px_24px]! grid gap-1 [box-shadow:var(--shadow)]! [&_b]:text-[32px]! [&_b]:tracking-[-.05em]! [&_b]:font-extrabold! [&_b]:text-[var(--ink)]! [&_.nx-tag]:text-neutral-600!",
  "nx-tag": "text-xs text-[var(--muted)]",
  "nx-seg": "[border-top:1px_solid_#f5f5f5]! mt-3.5 pt-3",
  "nx-seg-title":
    "text-sm font-bold! text-neutral-600! mb-2 tracking-[-.01em]!",
  "nx-cons":
    "[background:#fff6e5]! rounded-[14px]! [padding:10px_12px] text-sm [margin:8px_0] text-[#7a4a00]!",
  "nx-steps":
    "flex flex-wrap gap-1.5 [list-style:none] p-0 [margin:10px_0_0] [&_li]:flex [&_li]:items-center [&_li]:gap-1.5 [&_li]:text-sm [&_li]:font-bold [&_li]:text-neutral-600! [&_li]:[padding:5px_10px] [&_li]:rounded-[99px] [&_li]:bg-neutral-100! [&_li_span]:w-5 [&_li_span]:h-5 [&_li_span]:rounded-full [&_li_span]:bg-neutral-200! [&_li_span]:grid [&_li_span]:place-items-center [&_li_span]:text-xs [&_li.done]:text-[var(--green)]! [&_li.done]:[background:var(--green-bg)]! [&_li.done_span]:[background:var(--green)]! [&_li.done_span]:text-[#fff] [&_li.cur]:text-[var(--tp-d)]! [&_li.cur]:[background:var(--tp-soft)]! [&_li.cur]:shadow-none! [&_li.cur_span]:[background:var(--tp)]! [&_li.cur_span]:text-[#fff]",
  "nx-opts": "grid [gap:9px]",
  "nx-opt":
    "[border:1.5px_solid_transparent]! bg-neutral-50! rounded-[16px]! p-4! flex gap-3 text-left cursor-pointer w-full text-sm text-[var(--ink)] [&:hover]:[border-color:var(--tp)]! [&:hover]:[background:var(--tp-soft2)]! [&.rec]:[border-color:var(--tp)]! [&.rec]:[background:var(--tp-soft2)]!",
  "nx-radio": "text-[18px] text-[var(--tp-d)]!",
  "nx-rec":
    "mt-2.5 [background:var(--tp-soft)]! rounded-[16px]! [padding:12px_14px] grid gap-1.5 [justify-items:start]",
  "nx-chips":
    "flex flex-wrap gap-1.5 mt-1.5 [&_span]:text-xs [&_span]:font-bold [&_span]:bg-neutral-100! [&_span]:text-neutral-600! [&_span]:rounded-[99px] [&_span]:[padding:3px_9px] [&_span.pass]:[background:var(--green-bg)]! [&_span.pass]:text-[var(--green)]! [&_span.unknown]:[background:var(--amber-bg)]! [&_span.unknown]:text-[var(--amber)]!",
  "nx-applied":
    "[background:var(--tp-soft2)]! border-0! rounded-[16px]! [padding:12px_14px] [&_ul]:[margin:8px_0] [&_ul]:pl-4.5 [&_ul]:text-sm [&_ul]:leading-[1.8]",
  "nx-ul": "[margin:8px_0] pl-4.5 text-sm leading-[1.8]",
  "nx-vchange": "flex gap-2 items-center [margin:6px_0]",
  "nx-prep":
    "flex justify-between items-center gap-2.5 [padding:10px_0] [border-bottom:1px_solid_var(--line)] flex-wrap [border-color:#f5f5f5]! [&:last-child]:border-0",
  "nx-ok":
    "[background:var(--green-bg)]! text-[var(--green)]! rounded-[12px]! [padding:10px_12px] font-bold text-sm mb-1.5",
  "nx-ta":
    "w-full min-h-22.5 [border:1.5px_solid_transparent]! rounded-[14px]! [padding:12px_16px]! [font-family:inherit] text-base! bg-neutral-50! text-[var(--ink)]! [transition:border-color_.15s,background_.15s] [&:focus]:[outline:0]! [&:focus]:[border-color:var(--tp)]! [&:focus]:[background:#fff]!",
  "nx-seltabs":
    "flex gap-1.5 flex-wrap mb-3 [&_button]:border-0! [&_button]:bg-neutral-100! [&_button]:text-neutral-600! [&_button]:rounded-full! [&_button]:[padding:0_16px]! [&_button]:text-sm [&_button]:font-bold! [&_button]:cursor-pointer [&_button]:min-h-9.5! [&_button.on]:[background:var(--tp)]! [&_button.on]:[border-color:var(--primary)] [&_button.on]:text-[#fff]!",
  "nx-check":
    "flex [gap:11px] items-start [padding:12px_0] [border-bottom:1px_solid_var(--line)] [border-color:#f5f5f5]! [&:last-child]:border-0 [&_input]:w-4.5 [&_input]:h-4.5 [&_input]:[margin-top:3px] [&_input]:[accent-color:var(--tp)]!",
  "nx-date":
    "text-right text-sm font-bold min-w-15 text-neutral-600! [&_small]:text-[var(--muted)] [&_small]:font-medium [&_small]:text-xs",
  "nx-dot": "w-2.5 h-2.5 rounded-full mt-1.5",
  "nx-empty": "text-center p-7 text-[var(--muted)] text-sm",
  "nx-lock": "text-center p-9",
  "nx-prog":
    "[height:7px] rounded-[99px] bg-neutral-200! overflow-hidden w-57.5 max-w-full [&_div]:h-full [&_div]:[background:var(--tp)]!",
  "nx-calwrap":
    "grid [grid-template-columns:minmax(0,1.6fr)_minmax(260px,1fr)] gap-4 [align-items:start] [@media(max-width:900px)]:grid-cols-1",
  "nx-week":
    "grid [grid-template-columns:repeat(7,1fr)] gap-1 [&_span]:text-center [&_span]:text-xs [&_span]:text-[var(--muted)] [&_span]:[padding:4px_0]",
  "nx-calgrid": "grid [grid-template-columns:repeat(7,1fr)] gap-1",
  "nx-cell":
    "min-h-16 border-0! bg-neutral-50! rounded-[12px]! [padding:5px] flex flex-col items-start gap-1 cursor-pointer [font-family:inherit] text-[var(--ink)] [&.out]:border-0 [&.out]:[background:transparent] [&.out]:cursor-default [&.sel]:[box-shadow:inset_0_0_0_2px_var(--tp)]! [&.open]:bg-neutral-100! [&.today_.nx-dn]:[background:var(--tp)]! [&.today_.nx-dn]:text-[#fff] [&.today_.nx-dn]:rounded-full [&.today_.nx-dn]:w-5.5 [&.today_.nx-dn]:h-5.5 [&.today_.nx-dn]:grid [&.today_.nx-dn]:place-items-center [@media(max-width:600px)]:min-h-13",
  "nx-dn": "text-xs font-bold",
  "nx-flag": "text-xs font-extrabold text-neutral-700",
  "nx-dots":
    "flex [gap:3px] flex-wrap [&_i]:w-2 [&_i]:h-2 [&_i]:rounded-full [&_i]:block",
  "nx-legend": "flex flex-wrap gap-2.5 mt-3",
  "nx-leg":
    "text-xs text-[var(--muted)] flex [gap:5px] items-center [&_i]:[width:9px] [&_i]:[height:9px] [&_i]:rounded-full",
  "nx-alert":
    "flex gap-3 [padding:15px_0] [border-bottom:1px_solid_var(--line)] items-start [border-color:#f5f5f5]! [&:last-child]:border-0 [&.read_.nx-adot]:bg-neutral-300",
  "nx-adot":
    "[width:9px] [height:9px] rounded-full [background:var(--tp)]! mt-2 shrink-0",
  "nx-filters": "grid gap-1",
  "nx-sel":
    "[&_select]:[border:1px_solid_var(--line)] [&_select]:rounded-[8px] [&_select]:p-2 [&_select]:[background:#fff] [&_select]:[font-family:inherit] [&_select]:text-base",
  "nx-ggrid":
    "grid [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4",
  "nx-gcard":
    "bg-neutral-50! border-0! rounded-[var(--radius)]! overflow-hidden flex flex-col [box-shadow:var(--shadow)]!",
  "nx-gbody": "p-4 grid gap-2 [&_h3]:[margin:2px_0] [&_h3]:text-lg",
  "nx-poster":
    "relative h-50 p-4.5 text-neutral-900 overflow-hidden flex flex-col justify-end gap-1 rounded-none! [&.big]:h-65 [&.big]:rounded-[14px] [&.big]:min-w-50 [&_svg]:absolute [&_svg]:inset-0 [&_svg]:w-full [&_svg]:h-full [&>div]:relative [@media(max-width:600px)]:[&.big]:min-w-0",
  "nx-pk": "text-xs font-bold text-neutral-600 tracking-[.06em]",
  "nx-pt": "text-[18px] font-extrabold leading-[1.35] tracking-[-.03em]",
  "nx-pa": "text-sm font-bold text-foundy-primary-ink",
  "nx-po": "text-xs text-neutral-600",
  "nx-pd":
    "absolute! top-3.5 right-3.5 bg-white text-neutral-700 rounded-[99px] [padding:3px_10px] text-xs font-extrabold",
  "nx-pmark": "text-xs text-neutral-600 mt-1",
  "nx-lrow":
    "flex gap-3 items-center [padding:12px_0] [border-bottom:1px_solid_var(--line)] [border-color:#f5f5f5]! [&:last-child]:border-0 [&_.nx-poster]:h-20 [&_.nx-poster]:p-2 [&_.nx-poster>div:not(.nx-pd)]:hidden [&_.nx-pd]:top-1.5 [&_.nx-pd]:right-1.5 [&_.nx-pd]:text-xs [&_.nx-pd]:[padding:2px_6px]",
  "nx-gdetail":
    "grid [grid-template-columns:200px_1fr] gap-4 [@media(max-width:900px)]:grid-cols-1",
  "nx-map": "w-full h-auto rounded-[18px]! border-0! block",
  "nx-kv":
    "flex justify-between gap-2.5 [padding:7px_0] [border-bottom:1px_solid_#f5f5f5] text-sm [border-color:#f5f5f5]! [&_span]:text-[var(--muted)]",
  "nx-na": "text-neutral-600 font-medium",
  "nx-bar":
    "grid [grid-template-columns:minmax(0,90px)_minmax(0,1fr)_auto] gap-2 items-center text-sm [margin:5px_0] [&_div]:h-2 [&_div]:bg-neutral-100! [&_div]:rounded-[99px] [&_i]:block [&_i]:h-full [&_i]:[background:var(--tp)]! [&_i]:rounded-[99px] [&_em]:not-italic [&_em]:text-[var(--muted)] [&_em]:text-right [&_div_i]:[background:var(--tp)]!",
  "nx-call":
    "mt-2.5 grid gap-1 [&_ol]:[margin:0_0_6px] [&_ol]:pl-5 [&_ol]:text-sm [&_ol]:leading-[1.8] [&_ul]:[margin:0_0_6px] [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:leading-[1.8]",
  onboarding: "[body&_.sidebar]:hidden! [body&_.main]:ml-0!",
  "nx-hint": "block text-[var(--tp-d)]! text-sm font-semibold leading-[1.5]",
  "nx-sticky": "sticky bottom-3 z-5 [box-shadow:0_12px_40px_rgba(0,0,0,.14)]!",
  "nx-next":
    "mt-3 [background:var(--tp-soft2)]! border-0! rounded-[16px]! p-3.5 [&_ol]:[margin:10px_0_0] [&_ol]:p-0 [&_ol]:[list-style:none] [&_ol]:grid [&_ol]:gap-2 [&_li]:flex [&_li]:justify-between [&_li]:items-center [&_li]:gap-2.5 [&_li]:flex-wrap [&_li]:[background:#fff]! [&_li]:border-0! [&_li]:rounded-[14px]! [&_li]:[padding:10px_12px] [&_li]:text-sm",
  "nx-pbar":
    "relative h-2.5 bg-neutral-200! rounded-[99px] [margin:16px_0_8px] [&_i]:absolute [&_i]:[top:-4px] [&_i]:w-1 [&_i]:h-4.5 [&_i]:rounded-[2px] [&_i]:bg-neutral-400 [&_i]:[transform:translateX(-2px)] [&_.nx-pme]:[background:var(--tp)]! [&_.nx-pme]:w-1.5 [&_.nx-pme]:h-5.5 [&_.nx-pme]:[top:-6px]",
  "nx-prow": "flex justify-between text-xs text-[var(--muted)]",
  "nx-link":
    "mt-2 text-sm text-neutral-600 [background:var(--tp-soft2)]! rounded-[16px]! [padding:8px_12px] leading-[1.7] border-0!",
  "nx-form":
    "grid [grid-template-columns:1fr_1fr] gap-4 mt-3.5 [&_.full]:[grid-column:1/-1] [@media(max-width:900px)]:grid-cols-1",
  "nx-f":
    "flex flex-col gap-1.5 text-sm font-bold text-neutral-600! [&.full]:[grid-column:1/-1] [&_input]:[border:1.5px_solid_transparent]! [&_input]:rounded-[14px]! [&_input]:[padding:12px_16px]! [&_input]:[font-family:inherit] [&_input]:text-base! [&_input]:bg-neutral-50! [&_input]:text-[var(--ink)]! [&_input]:min-h-12 [&_input]:[transition:border-color_.15s,background_.15s] [&_select]:[border:1.5px_solid_transparent]! [&_select]:rounded-[14px]! [&_select]:[padding:12px_16px]! [&_select]:[font-family:inherit] [&_select]:text-base! [&_select]:bg-neutral-50! [&_select]:text-[var(--ink)]! [&_select]:min-h-12 [&_select]:[transition:border-color_.15s,background_.15s] [&_small]:font-medium [&_small]:text-[var(--muted)] [&_small]:text-sm [&_textarea]:bg-neutral-50! [&_textarea]:[border:1.5px_solid_transparent]! [&_textarea]:rounded-[14px]! [&_textarea]:min-h-12 [&_textarea]:[padding:12px_16px]! [&_textarea]:text-base! [&_textarea]:text-[var(--ink)]! [&_textarea]:[transition:border-color_.15s,background_.15s] [&_input:focus]:[outline:0]! [&_input:focus]:[border-color:var(--tp)]! [&_input:focus]:[background:#fff]! [&_select:focus]:[outline:0]! [&_select:focus]:[border-color:var(--tp)]! [&_select:focus]:[background:#fff]!",
  "nx-yn":
    "border-0! rounded-[12px]! bg-neutral-100! [padding:10px_19px] text-neutral-600! text-sm font-extrabold cursor-pointer min-h-10.5 [&.on]:text-[#fff]! [&.on]:[border-color:#107e7d] [&.on]:[background:var(--tp)]!",
  tag: "rounded-none! text-xs! tracking-[0]! font-[650]!",
  "nx-hero":
    "grid [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] [gap:clamp(20px,4vw,56px)] items-center [margin:8px_0_34px] [@media(max-width:900px)]:grid-cols-1",
  "nx-hero-copy":
    "[padding:8px_0] [&_.nx-hchip]:inline-flex [&_.nx-hchip]:items-center [&_.nx-hchip]:gap-2 [&_.nx-hchip]:[background:var(--tp-soft)] [&_.nx-hchip]:text-[var(--tp-d)] [&_.nx-hchip]:rounded-full [&_.nx-hchip]:[padding:7px_14px] [&_.nx-hchip]:font-extrabold [&_.nx-hchip]:text-sm [&_.nx-hchip]:mb-4.5 [&_h1]:text-[clamp(32px,4.6vw,52px)] [&_h1]:leading-[1.22] [&_h1]:font-extrabold [&_h1]:tracking-[-.055em] [&_h1]:[margin:0_0_18px] [&_h1]:text-[var(--ink)] [&_h1_em]:not-italic [&_h1_em]:text-[var(--tp-d)] [&_p]:text-[clamp(16px,1.6vw,19px)] [&_p]:leading-[1.7] [&_p]:text-[var(--muted)] [&_p]:[margin:0_0_28px] [&_p]:[max-width:30em]",
  "nx-hero-cta":
    "flex gap-2.5 flex-wrap [&_.nx-btn]:min-h-13! [&_.nx-btn]:[padding:0_26px]! [&_.nx-btn]:text-base! [&_.nx-btn]:rounded-[16px]!",
  "nx-hero-art":
    "relative [aspect-ratio:1.45/1] rounded-[30px] overflow-hidden [background:radial-gradient(60%_70%_at_50%_55%,#e5e5e5_0,#f5f5f5_45%,#fafafa_80%,#fff_100%)] [box-shadow:var(--shadow)] [&:before]:[content:''] [&:before]:absolute [&:before]:rounded-full [&:before]:[filter:blur(36px)] [&:before]:opacity-55 [&:before]:[width:46%] [&:before]:[height:60%] [&:before]:[left:6%] [&:before]:[top:22%] [&:before]:bg-neutral-200 [&:after]:[content:''] [&:after]:absolute [&:after]:rounded-full [&:after]:[filter:blur(36px)] [&:after]:opacity-55 [&:after]:[width:46%] [&:after]:[height:60%] [&:after]:[right:4%] [&:after]:[top:18%] [&:after]:bg-neutral-100 [@media(max-width:900px)]:order-first",
  "nx-glass":
    "absolute [left:50%] [top:50%] [width:34%] [aspect-ratio:1] [transform:translate(-50%,-50%)] rounded-[26%] [background:linear-gradient(145deg,rgba(255,255,255,.95),rgba(255,255,255,.55))] [box-shadow:0_22px_50px_rgba(0,0,0,.10),inset_0_2px_0_rgba(255,255,255,.9),inset_0_-10px_24px_rgba(0,0,0,.04)] grid place-items-center [backdrop-filter:blur(8px)] [animation:nxfloat_5s_ease-in-out_infinite] [&_svg]:[width:62%] [&_svg]:[height:62%] [&_svg]:[filter:drop-shadow(0_8px_12px_rgba(0,0,0,.12))] [@media(prefers-reduced-motion:reduce)]:[animation:none]",
  "nx-glass-shadow":
    "absolute [left:50%] [bottom:17%] [width:30%] [height:5%] [transform:translateX(-50%)] [background:radial-gradient(closest-side,rgba(0,0,0,.12),transparent)] [filter:blur(4px)]",
};
const elementRecipes: Record<string, string> = {
  button:
    "cursor-pointer [font-family:inherit]! tracking-[inherit] [transition:background-color_.15s_ease,border-color_.15s_ease,color_.15s_ease,transform_.15s_ease] rounded-none! [&:focus-visible]:[outline:2px_solid_#107e7d] [&:focus-visible]:[outline-offset:3px] [&:active]:[transform:translateY(1px)]",
  input:
    "[font-family:inherit]! tracking-[inherit] [&:focus-visible]:[outline:2px_solid_#107e7d] [&:focus-visible]:[outline-offset:3px]",
  select:
    "[font-family:inherit]! cursor-pointer tracking-[inherit] [&:focus-visible]:[outline:3px_solid_#107e7d] [&:focus-visible]:[outline-offset:3px]",
  textarea:
    "[font-family:inherit]! tracking-[inherit] [&:focus-visible]:[outline:3px_solid_#107e7d] [&:focus-visible]:[outline-offset:3px]",
  a: "text-inherit no-underline [&:focus-visible]:[outline:2px_solid_#107e7d] [&:focus-visible]:[outline-offset:3px]",
};

export function resolveUiClasses(tag: string, originalClass = ""): string {
  const classes = originalClass.split(/\s+/).filter(Boolean);
  return [
    originalClass,
    elementRecipes[tag] || "",
    ...classes.map((name) => componentRecipes[name] || ""),
  ]
    .filter(Boolean)
    .join(" ");
}
