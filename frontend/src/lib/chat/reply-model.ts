import { OFFS } from "@/data/checklist";
import { GRANTS } from "@/data/grants";
import { addDays, D, dday, diffDays, iso, realToday } from "@/lib/date";
import type { ReplyDependencies } from "@/types/dependencies";

/** Explicit dependencies keep this feature independent from application wiring. */

export function createReplyModel(context: ReplyDependencies) {
  function parseDate(t: any): any {
    let m: any = t.match(/(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/),
      y: any,
      mo: any,
      d: any;
    if (m) {
      y = +m[1];
      mo = +m[2];
      d = +m[3];
    } else {
      m = t.match(/(\d{1,2})\s*월\s*(?:(\d{1,2})\s*일)?/);
      if (!m) return null;
      mo = +m[1];
      d = m[2] ? +m[2] : 1;
      y = D(context.S.opening).getFullYear();
      if (new Date(y, mo - 1, d) < realToday()) y++;
    }
    const dt: any = new Date(y, mo - 1, d);
    if (isNaN(dt) || dt.getMonth() !== mo - 1) return null;
    return iso(dt);
  }

  function explainCard(c: any, t: any): any {
    const st: any = context.RS[c.id] || {},
      o: any = c.options.find((x: any) => x.id === st.chosen);
    let txt: any;
    if (c.base === "ok" && !c.options.length)
      txt = "이 항목은 문제가 없어요. " + c.reason;
    else if (/안 하면|어떻게 되|위험|결과|못 열/.test(t) && c.consequence)
      txt = c.consequence;
    else if (
      /다른 방법|선택지|옵션|대안|방법|달라|차이|비교/.test(t) &&
      c.options.length
    ) {
      const r: any = c.options.find((x: any) => c.rec && x.id === c.rec.id);
      txt =
        "선택지는 이렇게 있어요.\n" +
        context.optList(c) +
        (r ? "\n\n추천은 “" + r.label + "”예요. " + c.rec.reason : "");
    } else if (/다른 방법|선택지|방법/.test(t) && !c.options.length)
      txt =
        "이 항목은 담당 기관에 직접 확인해야 해요.";
    else
      txt = c.reason + (c.consequence ? "\n\n안 하면: " + c.consequence : "");
    if (o) txt += "\n\n지금은 “" + o.label + "”를 적용한 상태예요.";
    const follow: any = [
      "왜 이런가요?",
      "안 하면 어떻게 되나요?",
      "다른 방법은 없나요?",
    ];
    if (c.contact) follow.push("전화로 문의할 땐 뭐라고 하죠?");
    return context.A({
      text: txt,
      cites: [c.id],
      follow,
      acts: [
        {
          type: "navigate",
          label: "점검 리포트에서 이 카드 열기",
          payload: { p: "report", focus: c.id },
        },
      ],
    });
  }

  function topicCard(t: any, cards: any): any {
    const m: any = [
      ["building_violation", /위반 ?건축/],
      ["building_use", /술|주류|일반음식점|휴게음식점|건물 용도|용도|근린생활/],
      ["trademark_similar", /상표|상호|가게 이름|이름이|KIPRIS|겹/],
      ["permit_docs", /서류|영업신고|위생교육|건강진단|보건증|신고서/],
      ["ad_claims", /메뉴|광고|문구|효능|표현/],
    ];
    for (const [k, rx] of m)
      if (rx.test(t))
        return { key: k, card: cards.find((c: any) => c.check === k) || null };
    return null;
  }

  function todayReply(cards: any): any {
    const d: any = diffDays(D(context.S.opening), realToday());
    if (context.S.location === "undecided")
      return context.A({
        text:
          "개업까지 D-" +
          d +
          "예요. 지금은 자리를 정하는 게 먼저예요.\n① 결정할 것: 후보 상권 중 한 곳 고르기 (경쟁이 낮은 곳부터 비교)\n② 직접 할 일: “여기로 정하기”에서 후보 주소 입력 (3분)",
        cites: [{ t: "nav", p: "sites", label: "상권 분석" }],
        acts: [
          {
            type: "navigate",
            label: "후보 상권 보러 가기",
            payload: { p: "sites" },
          },
        ],
      });
    const pend: any = context
        .pendingDecisions()
        .sort(
          (a: any, b: any) =>
            Number(b.base === "high") - Number(a.base === "high"),
        ),
      dec: any = pend[0];
    const lines: any = ["개업까지 D-" + d + "예요. 오늘은 두 가지만 하세요."],
      cites: any = [],
      acts: any = [];
    if (dec) {
      const r: any = dec.options.find(
        (o: any) => dec.rec && o.id === dec.rec.id,
      );
      lines.push(
        "① 결정할 것: “" +
          dec.title +
          "”" +
          (r ? "\n   추천은 “" + r.label + "”예요." : ""),
      );
      cites.push(dec.id);
      if (r)
        acts.push({
          type: "choose_option",
          label: "“" + r.label + "” 적용",
          summary: r.fx.changes,
          payload: { id: dec.id, o: r.id },
        });
    } else lines.push("① 결정할 것: 지금 결정 대기 중인 항목은 없어요.");
    const ac: any = cards.find((c: any) => {
      const a: any = context.curAction(c);
      if (!a) return false;
      if (c.options.length && !(context.RS[c.id] && context.RS[c.id].chosen))
        return false;
      return (
        ((context.RS[c.id] && context.RS[c.id].action) || "pending") !== "done"
      );
    });
    const pick: any = ac || (dec && context.curAction(dec) ? dec : null);
    if (pick) {
      const a: any = context.curAction(pick);
      lines.push("② 직접 할 일: " + a.text + " (" + a.min + "분)");
      if (cites.indexOf(pick.id) < 0) cites.push(pick.id);
      acts.push({
        type: "navigate",
        label: "카드에서 이어서 하기",
        payload: { p: "report", focus: pick.id },
      });
    } else {
      const tk: any = context.allTasks().filter((x: any) => !x.done)[0];
      if (tk) {
        lines.push(
          "② 직접 할 일: “" +
            tk.task +
            "” (예정 " +
            tk.due.slice(5).replace("-", ".") +
            ")",
        );
        cites.push({ t: "nav", p: "checklist", label: "체크리스트" });
        acts.push({
          type: "navigate",
          label: "체크리스트 열기",
          payload: { p: "checklist" },
        });
      } else lines.push("② 직접 할 일: 남은 체크리스트가 없어요.");
    }
    return context.A({
      text: lines.join("\n"),
      cites,
      acts,
      follow: pick && pick.contact ? ["전화로 문의할 땐 뭐라고 하죠?"] : [],
    });
  }

  function callReply(t: any, focus: any, cards: any): any {
    const key: any = /세무|세금|부가|사업자/.test(t)
      ? "tax"
      : /고용|4대|근로|직원|보험/.test(t)
        ? "labor"
        : /위생|영업신고|교육|건강진단/.test(t)
          ? "hyg"
          : /건축|건물|용도|위반|구청/.test(t)
            ? "build"
            : (focus && focus.contact) || null;
    if (
      context.S.location === "undecided" &&
      (key === "build" || key === "hyg")
    )
      return context.A({
        kind: "oos",
        text: "아직 주소가 없어서 건물 점검을 하지 못했어요. 자리를 정하면 구청에 물어볼 내용과 통화 순서를 준비해 드릴게요.",
        acts: [
          {
            type: "navigate",
            label: "상권 분석 보기",
            payload: { p: "sites" },
          },
        ],
      });
    if (key === "build" || key === "hyg") {
      const c: any =
        (focus && focus.contact === key && focus) ||
        cards.find((x: any) => x.contact === key && x.base !== "ok") ||
        cards.find((x: any) => x.contact === key);
      if (c)
        return context.A({
          text: "담당 기관에 상황을 설명하는 순서와 꼭 물어볼 질문을 정리했어요.",
          cites: [c.id],
          call: c.id,
          follow: ["오늘 뭐부터 하죠?"],
        });
    }
    if (key === "tax" || key === "labor")
      return context.A({
        kind: "oos",
        text:
          (key === "tax" ? "세금·사업자등록 문의" : "근로계약·4대보험 문의") +
          "는 아래 담당 기관에 확인하세요.",
        contacts: [key],
      });
    return context.A({
      kind: "oos",
      text: "문의할 곳을 고르기 어려우면 정부민원안내콜센터에 담당 기관을 물어보세요.",
      contacts: ["build", "hyg", "tax", "labor", "gen"],
    });
  }

  function dateReply(t: any): any {
    const cur: any = context.S.opening;
    let nd: any = parseDate(t),
      guess: any = false;
    if (!nd) {
      nd = iso(addDays(D(cur), /당기|앞당/.test(t) ? -14 : 28));
      guess = true;
    }
    if (nd === cur)
      return context.A({
        kind: "chitchat",
        text: "이미 개업일이 " + cur + "로 잡혀 있어요.",
      });
    if (D(nd) < realToday())
      return context.A({
        kind: "chitchat",
        text:
          nd +
          "는 이미 지난 날짜예요. 오늘 이후 날짜로 말씀해 주세요. 예) 2027-04-01",
      });
    const pv: any = context.tasks.slice(0, 3).map(
      (tk: any, i: any) =>
        "“" +
        tk.task.slice(0, 12) +
        "…” " +
        tk.due.slice(5).replace("-", ".") +
        " → " +
        iso(addDays(D(nd), OFFS[i]))
          .slice(5)
          .replace("-", "."),
    );
    return context.A({
      kind: "change",
      text:
        (guess ? "날짜를 말씀하지 않으셔서 " : "") +
        "개업일을 " +
        nd +
        "로 바꾸는 제안이에요. 개업일을 바꿔도 외부 조회는 다시 하지 않고 체크리스트 날짜만 다시 계산해요.",
      acts: [
        {
          type: "update_store",
          label: "개업일 " + cur + " → " + nd + " 변경",
          summary: ["개업일 " + cur + " → " + nd, ...pv],
          payload: { date: nd },
        },
      ],
      follow: ["오늘 뭐부터 하죠?"],
    });
  }

  function checkReply(t: any): any {
    const map: any = [
        [/사업자등록/, "c-03"],
        [/위생교육/, "c-05"],
        [/건강진단/, "c-06"],
        [/간판/, "c-07"],
        [/근로|고용/, "c-08"],
        [/영업신고|서류/, "c-04"],
      ],
      l: any = context.allTasks();
    const hit: any = map.find(([rx]: any) => rx.test(t));
    const tk: any = hit
      ? l.find((x: any) => x.id === hit[1])
      : l.find((x: any) => !x.done);
    if (!tk)
      return context.A({
        kind: "chitchat",
        text: "해당하는 체크리스트 항목을 찾지 못했어요. 체크리스트 화면에서 직접 체크할 수 있어요.",
        acts: [
          {
            type: "navigate",
            label: "체크리스트 열기",
            payload: { p: "checklist" },
          },
        ],
      });
    if (tk.done)
      return context.A({
        kind: "chitchat",
        text: "“" + tk.task + "”는 이미 완료로 표시돼 있어요.",
      });
    return context.A({
      kind: "change",
      text:
        "“" +
        tk.task +
        "”를 완료로 표시하는 제안이에요. 확인하면 진행률에 반영돼요.",
      acts: [
        {
          type: "check_item",
          label: "“" + tk.task + "” 완료 처리",
          summary: [
            "체크리스트 진행률이 올라가요",
            "예정일 " + tk.due + " · 담당 " + tk.agency,
          ],
          payload: { id: tk.id, task: tk.task },
        },
      ],
    });
  }

  function chooseReply(t: any, focus: any): any {
    const pend: any = context.pendingDecisions();
    const c: any =
      focus && focus.options.length
        ? focus
        : pend.find((x: any) => t.includes(context.cardShort(x))) || pend[0];
    if (!c)
      return context.A({
        kind: "chitchat",
        text: "지금 결정 대기 중인 항목이 없어요. 이미 고른 선택은 점검 리포트에서 바꿀 수 있어요.",
        acts: [
          {
            type: "navigate",
            label: "점검 리포트 열기",
            payload: { p: "report" },
          },
        ],
      });
    const st: any = context.RS[c.id] || {};
    if (st.chosen) {
      const o: any = c.options.find((x: any) => x.id === st.chosen);
      return context.A({
        text:
          "“" +
          c.title +
          "”는 이미 “" +
          (o ? o.label : "") +
          "”로 진행 중이에요. 바꾸려면 카드에서 “선택 변경”을 누르세요.",
        cites: [c.id],
        acts: [
          {
            type: "navigate",
            label: "카드 열기",
            payload: { p: "report", focus: c.id },
          },
        ],
      });
    }
    const score: any = (o: any) =>
      o.label
        .split(/[\s()]+/)
        .filter((w: any) => w.length >= 2 && t.includes(w)).length +
      (/(^|[^A-Za-z])B([^A-Za-z]|$)/.test(t) &&
      o.id === "o-3" &&
      c.id === "r-01"
        ? 2
        : 0);
    let o: any = c.options
      .slice()
      .sort((a: any, b: any) => score(b) - score(a))[0];
    if (score(o) === 0)
      o =
        c.options.find((x: any) => c.rec && x.id === c.rec.id) || c.options[0];
    return context.A({
      kind: "change",
      text:
        "“" +
        c.title +
        "”에 “" +
        o.label +
        "”를 적용하는 제안이에요. 적용하면 이렇게 바뀌어요.",
      cites: [c.id],
      acts: [
        {
          type: "choose_option",
          label: "“" + o.label + "” 적용",
          summary: o.fx.changes,
          payload: { id: c.id, o: o.id },
        },
      ],
    });
  }

  function oosReply(t: any): any {
    if (/대출|융자|이자/.test(t))
      return context.A({
        kind: "oos",
        text: "대출 안내는 이 서비스에서 제공하지 않아요. 지원사업 화면의 융자 공고는 공고문 내용만 보여 드려요. 금리·한도는 공고 원문과 금융기관에서 확인하세요.",
        contacts: ["gen"],
        acts: [
          {
            type: "navigate",
            label: "지원사업 열기",
            payload: { p: "grants" },
          },
        ],
      });
    if (/4대|보험|근로|급여|월급|고용/.test(t))
      return context.A({
        kind: "oos",
        text: "4대보험·급여 문의는 이 가게의 점검 결과로는 알 수 없어요. 신고 기한과 요율은 바뀔 수 있어서 상담센터에 확인하세요.",
        contacts: ["labor"],
      });
    return context.A({
      kind: "oos",
      text: "세금 신고 일정은 이 가게의 점검 결과로는 알 수 없어요. 기한은 해마다 달라질 수 있어서 국세청에 확인하는 게 정확해요.",
      contacts: ["tax"],
    });
  }

  function otherReply(t: any): any {
    if (/지원사업|지원금|공고|마감 임박/.test(t)) {
      const g: any = GRANTS,
        e: any = g.filter((x: any) => x.res === "eligible").length,
        p: any = g.filter((x: any) => x.res === "partial").length,
        soon: any = g
          .filter((x: any) => x.deadline)
          .sort((a: any, b: any) => (a.deadline < b.deadline ? -1 : 1))[0];
      return context.A({
        text:
          "지원사업 공고 " +
          g.length +
          "건 중 신청 가능성 높음 " +
          e +
          "건, 일부 확인 필요 " +
          p +
          "건이에요. 가장 먼저 마감되는 건 “" +
          soon.title +
          "”(" +
          soon.deadline +
          ", " +
          dday(soon.deadline) +
          ")예요. 공고문 조건과 내 정보를 대조한 결과이고, 신청 전에는 원문 공고를 확인하세요.",
        cites: [{ t: "nav", p: "grants", label: "지원사업 화면" }],
        acts: [
          {
            type: "navigate",
            label: "지원사업 열기",
            payload: { p: "grants" },
          },
        ],
      });
    }
    if (/상권|경쟁|주변|카페가 몇|입지/.test(t)) {
      return context.A({
        text:
          "상권 분석 지도에서 위치와 반경을 선택하면 해당 지역의 서울 생활인구를 볼 수 있어요. 생활인구는 격자별 추정치예요. 선택한 반경 안의 카페·음식점도 카카오 지도 기준으로 살펴볼 수 있어요.",
        cites: [{ t: "nav", p: "sites", label: "상권 분석 지도" }],
        acts: [
          { type: "navigate", label: "지도 열기", payload: { p: "sites" } },
        ],
      });
    }
    if (/체크리스트|일정|언제까지|기한|d-/i.test(t)) {
      const l: any = context
        .allTasks()
        .filter((x: any) => !x.done)
        .slice(0, 3);
      return context.A({
        text: l.length
          ? "가장 가까운 일정이에요.\n" +
            l
              .map(
                (x: any) =>
                  "· " +
                  x.due.slice(5).replace("-", ".") +
                  " (" +
                  dday(x.due) +
                  ") " +
                  x.task,
              )
              .join("\n")
          : "남은 체크리스트가 없어요.",
        cites: [{ t: "nav", p: "checklist", label: "체크리스트" }],
        acts: [
          {
            type: "navigate",
            label: "달력으로 보기",
            payload: { p: "checklist" },
          },
        ],
      });
    }
    return null;
  }

  function reply(q: any): any {
    const t: any = q.replace(/\s+/g, " ").trim(),
      cards: any = context.buildCards(),
      un: any = context.S.location === "undecided",
      focus: any =
        context.CH.focus && !un
          ? cards.find((c: any) => c.id === context.CH.focus)
          : null,
      has: any = (rx: any) => rx.test(t);
    if (has(/오늘|뭐부터|이번 ?주|먼저 해/)) return todayReply(cards);
    if (has(/전화|통화|스크립트|말할|연락처|번호|어디에 (문의|물어)|누구에게/))
      return callReply(t, focus, cards);
    if (
      has(/개업일|오픈일|개업 날짜/) ||
      (has(/미루|연기|앞당|당기/) && has(/개업|오픈|날짜|월/))
    )
      return dateReply(t);
    if (
      has(/(완료|끝냈|마쳤|했어)/) &&
      has(/체크|사업자|위생교육|건강진단|간판|영업신고|근로|서류/)
    )
      return checkReply(t);
    if (
      has(/(열어|보여줘|이동|가줘|보러|화면)/) &&
      has(/리포트|체크리스트|달력|지도|상권|입지|지원사업/)
    ) {
      const mp: any = [
        [/리포트/, "report", "점검 리포트"],
        [/체크리스트|달력/, "checklist", "개업 체크리스트"],
        [/지도|상권|입지/, "sites", "상권 분석"],
        [/지원사업/, "grants", "지원사업"],
      ].find((x: any) => x[0].test(t));
      return context.A({
        kind: "chitchat",
        text: mp[2] + " 화면으로 이동할 수 있어요.",
        acts: [
          { type: "navigate", label: mp[2] + " 열기", payload: { p: mp[1] } },
        ],
      });
    }
    if (!un && has(/할게|진행해|적용|선택할|골라|추천대로|로 갈게/))
      return chooseReply(t, focus);
    if (
      has(
        /부가세|부가가치세|종합소득세|세금|세무|4대보험|보험료|급여|월급|대출|융자|이자/,
      )
    )
      return oosReply(t);
    const tp: any = topicCard(t, cards);
    if (un && tp)
      return context.A({
        kind: "oos",
        text: "아직 주소가 없어서 건물·서류 점검을 하지 못했어요. 자리를 정하면 이 질문에 점검 결과를 근거로 답할 수 있어요.",
        acts: [
          {
            type: "navigate",
            label: "상권 분석 보기",
            payload: { p: "sites" },
          },
        ],
      });
    if (tp && tp.card) return explainCard(tp.card, t);
    if (tp && !tp.card)
      return context.A({
        kind: "oos",
        text: "메뉴·광고 문구를 입력하지 않아서 이 항목은 점검하지 않았어요. 가게 정보 수정에서 메뉴 문구를 넣으면 점검해 드려요.",
        acts: [
          {
            type: "navigate",
            label: "가게 정보 수정",
            payload: { p: "mypage" },
          },
        ],
      });
    if (!un && has(/선택지|옵션|다른 방법|대안/)) {
      const p: any =
        context
          .pendingDecisions()
          .find((x: any) => t.includes(context.cardShort(x))) ||
        context.pendingDecisions()[0];
      if (p) return explainCard(p, t);
    }
    const o: any = otherReply(t);
    if (o) return o;
    if (focus) return explainCard(focus, t);
    if (has(/안녕|고마워|감사|ㅎㅎ|ㅋㅋ|누구/))
      return context.A({
        kind: "chitchat",
        text: "저는 이 가게의 점검 결과 안에서 답하는 상담 도우미예요. 오늘 할 일, 선택지 비교, 구청 통화 준비를 도와드려요.",
        follow: ["오늘 뭐부터 하죠?"],
      });
    return context.A({
      kind: "oos",
      text: "이 가게의 점검 결과로는 알 수 없어요. 구청이나 세무서 같은 관할 기관에 확인해 보세요.",
      contacts: ["gen"],
      follow: ["오늘 뭐부터 하죠?"],
    });
  }

  function suggestions(): any {
    if (context.CH.focus && context.S.location !== "undecided") {
      const c: any = context
        .buildCards()
        .find((x: any) => x.id === context.CH.focus);
      return [
        "왜 이런가요?",
        "안 하면 어떻게 되나요?",
        "다른 방법은 없나요?",
        c && c.contact ? "전화로 문의할 땐 뭐라고 하죠?" : null,
      ].filter(Boolean);
    }
    if (context.S.location === "undecided")
      return [
        "오늘 뭐부터 하죠?",
        "후보 상권 중 어디가 경쟁이 낮아요?",
        "구청에 전화하기 전에 뭘 준비하죠?",
        "부가세는 언제 신고하나요?",
      ];
    const out: any = ["오늘 뭐부터 하죠?"],
      p: any = context.pendingDecisions()[0];
    if (p) out.push(context.cardShort(p) + " 선택지 뭐가 달라요?");
    out.push(
      "구청에 전화하기 전에 뭘 준비하죠?",
      "개업일을 4월 1일로 미루고 싶어요",
      "부가세는 언제 신고하나요?",
    );
    return out.slice(0, 5);
  }
  return {
    parseDate,
    explainCard,
    topicCard,
    todayReply,
    callReply,
    dateReply,
    checkReply,
    chooseReply,
    oosReply,
    otherReply,
    reply,
    suggestions,
  };
}
