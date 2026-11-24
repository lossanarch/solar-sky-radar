/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const dt = globalThis, Mt = dt.ShadowRoot && (dt.ShadyCSS === void 0 || dt.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, zt = Symbol(), Dt = /* @__PURE__ */ new WeakMap();
let oe = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== zt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (Mt && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = Dt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && Dt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const se = (s) => new oe(typeof s == "string" ? s : s + "", void 0, zt), At = (s, ...t) => {
  const e = s.length === 1 ? s[0] : t.reduce((i, r, a) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + s[a + 1], s[0]);
  return new oe(e, s, zt);
}, ue = (s, t) => {
  if (Mt) s.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), r = dt.litNonce;
    r !== void 0 && i.setAttribute("nonce", r), i.textContent = e.cssText, s.appendChild(i);
  }
}, Wt = Mt ? (s) => s : (s) => s instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return se(e);
})(s) : s;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: ge, defineProperty: me, getOwnPropertyDescriptor: fe, getOwnPropertyNames: be, getOwnPropertySymbols: ve, getPrototypeOf: ye } = Object, R = globalThis, jt = R.trustedTypes, xe = jt ? jt.emptyScript : "", xt = R.reactiveElementPolyfillSupport, it = (s, t) => s, ut = { toAttribute(s, t) {
  switch (t) {
    case Boolean:
      s = s ? xe : null;
      break;
    case Object:
    case Array:
      s = s == null ? s : JSON.stringify(s);
  }
  return s;
}, fromAttribute(s, t) {
  let e = s;
  switch (t) {
    case Boolean:
      e = s !== null;
      break;
    case Number:
      e = s === null ? null : Number(s);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(s);
      } catch {
        e = null;
      }
  }
  return e;
} }, Pt = (s, t) => !ge(s, t), Zt = { attribute: !0, type: String, converter: ut, reflect: !1, useDefault: !1, hasChanged: Pt };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), R.litPropertyMetadata ?? (R.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let G = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = Zt) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), r = this.getPropertyDescriptor(t, i, e);
      r !== void 0 && me(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: r, set: a } = fe(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: r, set(o) {
      const n = r == null ? void 0 : r.call(this);
      a == null || a.call(this, o), this.requestUpdate(t, n, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Zt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(it("elementProperties"))) return;
    const t = ye(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(it("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(it("properties"))) {
      const e = this.properties, i = [...be(e), ...ve(e)];
      for (const r of i) this.createProperty(r, e[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, r] of e) this.elementProperties.set(i, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const r = this._$Eu(e, i);
      r !== void 0 && this._$Eh.set(r, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const r of i) e.unshift(Wt(r));
    } else t !== void 0 && e.push(Wt(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var t;
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (t = this.constructor.l) == null || t.forEach((e) => e(this));
  }
  addController(t) {
    var e;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && ((e = t.hostConnected) == null || e.call(t));
  }
  removeController(t) {
    var e;
    (e = this._$EO) == null || e.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return ue(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostConnected) == null ? void 0 : i.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var i;
      return (i = e.hostDisconnected) == null ? void 0 : i.call(e);
    });
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    var a;
    const i = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, i);
    if (r !== void 0 && i.reflect === !0) {
      const o = (((a = i.converter) == null ? void 0 : a.toAttribute) !== void 0 ? i.converter : ut).toAttribute(e, i.type);
      this._$Em = t, o == null ? this.removeAttribute(r) : this.setAttribute(r, o), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var a, o;
    const i = this.constructor, r = i._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const n = i.getPropertyOptions(r), h = typeof n.converter == "function" ? { fromAttribute: n.converter } : ((a = n.converter) == null ? void 0 : a.fromAttribute) !== void 0 ? n.converter : ut;
      this._$Em = r;
      const c = h.fromAttribute(e, n.type);
      this[r] = c ?? ((o = this._$Ej) == null ? void 0 : o.get(r)) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, r = !1, a) {
    var o;
    if (t !== void 0) {
      const n = this.constructor;
      if (r === !1 && (a = this[t]), i ?? (i = n.getPropertyOptions(t)), !((i.hasChanged ?? Pt)(a, e) || i.useDefault && i.reflect && a === ((o = this._$Ej) == null ? void 0 : o.get(t)) && !this.hasAttribute(n._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: r, wrapped: a }, o) {
    i && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), a !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), r === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var i;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [a, o] of this._$Ep) this[a] = o;
        this._$Ep = void 0;
      }
      const r = this.constructor.elementProperties;
      if (r.size > 0) for (const [a, o] of r) {
        const { wrapped: n } = o, h = this[a];
        n !== !0 || this._$AL.has(a) || h === void 0 || this.C(a, void 0, o, h);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (i = this._$EO) == null || i.forEach((r) => {
        var a;
        return (a = r.hostUpdate) == null ? void 0 : a.call(r);
      }), this.update(e)) : this._$EM();
    } catch (r) {
      throw t = !1, this._$EM(), r;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    var e;
    (e = this._$EO) == null || e.forEach((i) => {
      var r;
      return (r = i.hostUpdated) == null ? void 0 : r.call(i);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
G.elementStyles = [], G.shadowRootOptions = { mode: "open" }, G[it("elementProperties")] = /* @__PURE__ */ new Map(), G[it("finalized")] = /* @__PURE__ */ new Map(), xt == null || xt({ ReactiveElement: G }), (R.reactiveElementVersions ?? (R.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const rt = globalThis, Kt = (s) => s, gt = rt.trustedTypes, Gt = gt ? gt.createPolicy("lit-html", { createHTML: (s) => s }) : void 0, le = "$lit$", T = `lit$${Math.random().toFixed(9).slice(2)}$`, ne = "?" + T, we = `<${ne}>`, W = document, at = () => W.createComment(""), ot = (s) => s === null || typeof s != "object" && typeof s != "function", qt = Array.isArray, ke = (s) => qt(s) || typeof (s == null ? void 0 : s[Symbol.iterator]) == "function", wt = `[ 	
\f\r]`, tt = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Jt = /-->/g, Yt = />/g, U = RegExp(`>|${wt}(?:([^\\s"'>=/]+)(${wt}*=${wt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Xt = /'/g, Qt = /"/g, ce = /^(?:script|style|textarea|title)$/i, _e = (s) => (t, ...e) => ({ _$litType$: s, strings: t, values: e }), v = _e(1), J = Symbol.for("lit-noChange"), m = Symbol.for("lit-nothing"), te = /* @__PURE__ */ new WeakMap(), H = W.createTreeWalker(W, 129);
function he(s, t) {
  if (!qt(s) || !s.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Gt !== void 0 ? Gt.createHTML(t) : t;
}
const Ce = (s, t) => {
  const e = s.length - 1, i = [];
  let r, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = tt;
  for (let n = 0; n < e; n++) {
    const h = s[n];
    let c, l, d = -1, g = 0;
    for (; g < h.length && (o.lastIndex = g, l = o.exec(h), l !== null); ) g = o.lastIndex, o === tt ? l[1] === "!--" ? o = Jt : l[1] !== void 0 ? o = Yt : l[2] !== void 0 ? (ce.test(l[2]) && (r = RegExp("</" + l[2], "g")), o = U) : l[3] !== void 0 && (o = U) : o === U ? l[0] === ">" ? (o = r ?? tt, d = -1) : l[1] === void 0 ? d = -2 : (d = o.lastIndex - l[2].length, c = l[1], o = l[3] === void 0 ? U : l[3] === '"' ? Qt : Xt) : o === Qt || o === Xt ? o = U : o === Jt || o === Yt ? o = tt : (o = U, r = void 0);
    const p = o === U && s[n + 1].startsWith("/>") ? " " : "";
    a += o === tt ? h + we : d >= 0 ? (i.push(c), h.slice(0, d) + le + h.slice(d) + T + p) : h + T + (d === -2 ? n : p);
  }
  return [he(s, a + (s[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class st {
  constructor({ strings: t, _$litType$: e }, i) {
    let r;
    this.parts = [];
    let a = 0, o = 0;
    const n = t.length - 1, h = this.parts, [c, l] = Ce(t, e);
    if (this.el = st.createElement(c, i), H.currentNode = this.el.content, e === 2 || e === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (r = H.nextNode()) !== null && h.length < n; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const d of r.getAttributeNames()) if (d.endsWith(le)) {
          const g = l[o++], p = r.getAttribute(d).split(T), u = /([.?@])?(.*)/.exec(g);
          h.push({ type: 1, index: a, name: u[2], strings: p, ctor: u[1] === "." ? Ee : u[1] === "?" ? Se : u[1] === "@" ? Me : mt }), r.removeAttribute(d);
        } else d.startsWith(T) && (h.push({ type: 6, index: a }), r.removeAttribute(d));
        if (ce.test(r.tagName)) {
          const d = r.textContent.split(T), g = d.length - 1;
          if (g > 0) {
            r.textContent = gt ? gt.emptyScript : "";
            for (let p = 0; p < g; p++) r.append(d[p], at()), H.nextNode(), h.push({ type: 2, index: ++a });
            r.append(d[g], at());
          }
        }
      } else if (r.nodeType === 8) if (r.data === ne) h.push({ type: 2, index: a });
      else {
        let d = -1;
        for (; (d = r.data.indexOf(T, d + 1)) !== -1; ) h.push({ type: 7, index: a }), d += T.length - 1;
      }
      a++;
    }
  }
  static createElement(t, e) {
    const i = W.createElement("template");
    return i.innerHTML = t, i;
  }
}
function Y(s, t, e = s, i) {
  var o, n;
  if (t === J) return t;
  let r = i !== void 0 ? (o = e._$Co) == null ? void 0 : o[i] : e._$Cl;
  const a = ot(t) ? void 0 : t._$litDirective$;
  return (r == null ? void 0 : r.constructor) !== a && ((n = r == null ? void 0 : r._$AO) == null || n.call(r, !1), a === void 0 ? r = void 0 : (r = new a(s), r._$AT(s, e, i)), i !== void 0 ? (e._$Co ?? (e._$Co = []))[i] = r : e._$Cl = r), r !== void 0 && (t = Y(s, r._$AS(s, t.values), r, i)), t;
}
class $e {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, r = ((t == null ? void 0 : t.creationScope) ?? W).importNode(e, !0);
    H.currentNode = r;
    let a = H.nextNode(), o = 0, n = 0, h = i[0];
    for (; h !== void 0; ) {
      if (o === h.index) {
        let c;
        h.type === 2 ? c = new nt(a, a.nextSibling, this, t) : h.type === 1 ? c = new h.ctor(a, h.name, h.strings, this, t) : h.type === 6 && (c = new ze(a, this, t)), this._$AV.push(c), h = i[++n];
      }
      o !== (h == null ? void 0 : h.index) && (a = H.nextNode(), o++);
    }
    return H.currentNode = W, r;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class nt {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, i, r) {
    this.type = 2, this._$AH = m, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = r, this._$Cv = (r == null ? void 0 : r.isConnected) ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && (t == null ? void 0 : t.nodeType) === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = Y(this, t, e), ot(t) ? t === m || t == null || t === "" ? (this._$AH !== m && this._$AR(), this._$AH = m) : t !== this._$AH && t !== J && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : ke(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== m && ot(this._$AH) ? this._$AA.nextSibling.data = t : this.T(W.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var a;
    const { values: e, _$litType$: i } = t, r = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = st.createElement(he(i.h, i.h[0]), this.options)), i);
    if (((a = this._$AH) == null ? void 0 : a._$AD) === r) this._$AH.p(e);
    else {
      const o = new $e(r, this), n = o.u(this.options);
      o.p(e), this.T(n), this._$AH = o;
    }
  }
  _$AC(t) {
    let e = te.get(t.strings);
    return e === void 0 && te.set(t.strings, e = new st(t)), e;
  }
  k(t) {
    qt(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, r = 0;
    for (const a of t) r === e.length ? e.push(i = new nt(this.O(at()), this.O(at()), this, this.options)) : i = e[r], i._$AI(a), r++;
    r < e.length && (this._$AR(i && i._$AB.nextSibling, r), e.length = r);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var i;
    for ((i = this._$AP) == null ? void 0 : i.call(this, !1, !0, e); t !== this._$AB; ) {
      const r = Kt(t).nextSibling;
      Kt(t).remove(), t = r;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}
class mt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, r, a) {
    this.type = 1, this._$AH = m, this._$AN = void 0, this.element = t, this.name = e, this._$AM = r, this.options = a, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = m;
  }
  _$AI(t, e = this, i, r) {
    const a = this.strings;
    let o = !1;
    if (a === void 0) t = Y(this, t, e, 0), o = !ot(t) || t !== this._$AH && t !== J, o && (this._$AH = t);
    else {
      const n = t;
      let h, c;
      for (t = a[0], h = 0; h < a.length - 1; h++) c = Y(this, n[i + h], e, h), c === J && (c = this._$AH[h]), o || (o = !ot(c) || c !== this._$AH[h]), c === m ? t = m : t !== m && (t += (c ?? "") + a[h + 1]), this._$AH[h] = c;
    }
    o && !r && this.j(t);
  }
  j(t) {
    t === m ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Ee extends mt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === m ? void 0 : t;
  }
}
class Se extends mt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== m);
  }
}
class Me extends mt {
  constructor(t, e, i, r, a) {
    super(t, e, i, r, a), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = Y(this, t, e, 0) ?? m) === J) return;
    const i = this._$AH, r = t === m && i !== m || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, a = t !== m && (i === m || r);
    r && this.element.removeEventListener(this.name, this, i), a && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class ze {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    Y(this, t);
  }
}
const kt = rt.litHtmlPolyfillSupport;
kt == null || kt(st, nt), (rt.litHtmlVersions ?? (rt.litHtmlVersions = [])).push("3.3.3");
const Ae = (s, t, e) => {
  const i = (e == null ? void 0 : e.renderBefore) ?? t;
  let r = i._$litPart$;
  if (r === void 0) {
    const a = (e == null ? void 0 : e.renderBefore) ?? null;
    i._$litPart$ = r = new nt(t.insertBefore(at(), a), a, void 0, e ?? {});
  }
  return r._$AI(s), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const V = globalThis;
class D extends G {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ae(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var t;
    super.connectedCallback(), (t = this._$Do) == null || t.setConnected(!0);
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), (t = this._$Do) == null || t.setConnected(!1);
  }
  render() {
    return J;
  }
}
var ae;
D._$litElement$ = !0, D.finalized = !0, (ae = V.litElementHydrateSupport) == null || ae.call(V, { LitElement: D });
const _t = V.litElementPolyfillSupport;
_t == null || _t({ LitElement: D });
(V.litElementVersions ?? (V.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Pe = { attribute: !0, type: String, converter: ut, reflect: !1, hasChanged: Pt }, qe = (s = Pe, t, e) => {
  const { kind: i, metadata: r } = e;
  let a = globalThis.litPropertyMetadata.get(r);
  if (a === void 0 && globalThis.litPropertyMetadata.set(r, a = /* @__PURE__ */ new Map()), i === "setter" && ((s = Object.create(s)).wrapped = !0), a.set(e.name, s), i === "accessor") {
    const { name: o } = e;
    return { set(n) {
      const h = t.get.call(this);
      t.set.call(this, n), this.requestUpdate(o, h, s, !0, n);
    }, init(n) {
      return n !== void 0 && this.C(o, void 0, s, n), n;
    } };
  }
  if (i === "setter") {
    const { name: o } = e;
    return function(n) {
      const h = this[o];
      t.call(this, n), this.requestUpdate(o, h, s, !0, n);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function M(s) {
  return (t, e) => typeof e == "object" ? qe(s, t, e) : ((i, r, a) => {
    const o = r.hasOwnProperty(a);
    return r.constructor.createProperty(a, i), o ? Object.getOwnPropertyDescriptor(r, a) : void 0;
  })(s, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function $(s) {
  return M({ ...s, state: !0, attribute: !1 });
}
function ee(s) {
  var t;
  return s.CustomElementRegistryPolyfill !== void 0 || ((t = s.customElements) == null ? void 0 : t.get("home-assistant")) !== void 0 ? !1 : s.__haScopedRegistryReady !== void 0 ? !0 : typeof document < "u" ? document.querySelector("home-assistant") !== null : !1;
}
function Et(s, t, e) {
  const i = s.customElements;
  if (!i) return null;
  if (!i.get(t))
    try {
      i.define(t, e);
    } catch (r) {
      if (!i.get(t))
        return console.warn(`[solar-sky-radar] CustomElement define retry needed for <${t}>:`, r), null;
    }
  return i;
}
function ie(s, t, e, i) {
  var c, l;
  let r = t;
  const a = () => {
    const d = s.customElements;
    if (!d) return !1;
    if (d !== r || !d.get(e)) {
      const g = Et(s, e, i);
      if (g)
        return r = g, !0;
    }
    return !1;
  };
  typeof ((c = s.customElements) == null ? void 0 : c.whenDefined) == "function" && s.customElements.whenDefined("home-assistant").then(() => {
    a();
  }).catch(() => {
  });
  let o = 0;
  const n = 40, h = globalThis.setInterval(() => {
    var d;
    o += 1, a(), (o >= n || s.CustomElementRegistryPolyfill !== void 0 || ((d = s.customElements) == null ? void 0 : d.get("home-assistant")) !== void 0) && (a(), globalThis.clearInterval(h));
  }, 50);
  (l = h == null ? void 0 : h.unref) == null || l.call(h);
}
function Lt(s, t, e = globalThis.window) {
  if (!(e != null && e.customElements)) return;
  if (!ee(e)) {
    const n = Et(e, s, t);
    ie(e, n, s, t);
    return;
  }
  let i = !1;
  const r = () => {
    if (i) return;
    i = !0;
    const n = Et(e, s, t);
    ie(e, n, s, t);
  };
  e.__haScopedRegistryReady && Promise.resolve(e.__haScopedRegistryReady).catch(() => {
  }).then(r);
  const a = Date.now(), o = () => {
    if (!i) {
      if (!ee(e) || Date.now() - a >= 1200) {
        r();
        return;
      }
      globalThis.setTimeout(o, 10);
    }
  };
  globalThis.setTimeout(o, 10);
}
var Le = Object.defineProperty, j = (s, t, e, i) => {
  for (var r = void 0, a = s.length - 1, o; a >= 0; a--)
    (o = s[a]) && (r = o(t, e, r) || r);
  return r && Le(t, e, r), r;
};
const Ct = [0.5, 1, 1.5, 2], Tt = class Tt extends D {
  constructor() {
    super(...arguments), this.timeline = [], this.readySlots = [], this.currentIndex = 0, this.playing = !1, this.speed = 1, this.timeZone = "", this.dark = !0, this.dragging = !1, this.onPointerDown = (t) => {
      t.stopPropagation(), this.dragging = !0, t.currentTarget.setPointerCapture(t.pointerId), this.scrubFromPointer(t, !0);
    }, this.onPointerMove = (t) => {
      this.dragging && (t.stopPropagation(), this.scrubFromPointer(t, !1));
    }, this.onPointerUp = (t) => {
      if (this.dragging) {
        this.dragging = !1;
        try {
          t.currentTarget.releasePointerCapture(t.pointerId);
        } catch {
        }
      }
    };
  }
  formatSlotTime(t) {
    if (!t) return "--:--";
    const e = new Date(t.epoch * 1e3);
    try {
      return new Intl.DateTimeFormat(void 0, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: this.timeZone || void 0,
        timeZoneName: "short"
      }).format(e);
    } catch {
      return new Intl.DateTimeFormat(void 0, {
        hour: "numeric",
        minute: "2-digit"
      }).format(e);
    }
  }
  formatRelative(t) {
    if (t >= -2) return "LIVE";
    const e = Math.abs(t);
    if (e < 60) return `-${e}m`;
    const i = Math.floor(e / 60), r = e % 60;
    return r === 0 ? `-${i}h` : `-${i}h ${r}m`;
  }
  scrubFromPointer(t, e) {
    const r = t.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || this.timeline.length === 0) return;
    const a = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width)), o = Math.round(a * (this.timeline.length - 1));
    this.dispatchEvent(
      new CustomEvent("jog-seek", {
        detail: { index: o, pause: e },
        bubbles: !0,
        composed: !0
      })
    );
  }
  cycleSpeed() {
    const t = (Ct.indexOf(this.speed) + 1) % Ct.length, e = Ct[t] ?? 1;
    this.dispatchEvent(
      new CustomEvent("jog-speed", {
        detail: { speed: e },
        bubbles: !0,
        composed: !0
      })
    );
  }
  render() {
    const t = this.timeline.length, e = this.timeline[this.currentIndex], i = t > 1 ? this.currentIndex / (t - 1) * 100 : 100, r = this.currentIndex >= t - 1, a = this.timeline[0];
    return v`
      <div class="bar" data-theme=${this.dark ? "dark" : "light"}>
        <div class="top-row">
          <div class="transport">
            <button
              class="ctrl"
              title="Previous frame"
              aria-label="Previous frame"
              @click=${() => this.dispatchEvent(
      new CustomEvent("jog-step", {
        detail: { delta: -1 },
        bubbles: !0,
        composed: !0
      })
    )}
            >
              &#9664;
            </button>
            <button
              class="ctrl play-btn"
              title=${this.playing ? "Pause 2-hour loop" : "Play 2-hour loop"}
              aria-label=${this.playing ? "Pause" : "Play"}
              @click=${() => this.dispatchEvent(
      new CustomEvent("jog-toggle", { bubbles: !0, composed: !0 })
    )}
            >
              ${this.playing ? "❚❚" : "▶"}
            </button>
            <button
              class="ctrl"
              title="Next frame"
              aria-label="Next frame"
              @click=${() => this.dispatchEvent(
      new CustomEvent("jog-step", {
        detail: { delta: 1 },
        bubbles: !0,
        composed: !0
      })
    )}
            >
              &#9654;
            </button>
            <button
              class="ctrl"
              title="Playback speed"
              @click=${this.cycleSpeed}
            >
              ${this.speed}x
            </button>
          </div>

          <div class="time-readout">
            <span>${this.formatSlotTime(e)}</span>
            <span class="offset-badge ${r ? "offset-now" : "offset-past"}">
              ${e ? this.formatRelative(e.offset_minutes) : "..."}
            </span>
          </div>
        </div>

        <div
          class="scrubber-wrap"
          role="slider"
          tabindex="0"
          aria-valuemin="0"
          aria-valuemax=${Math.max(0, t - 1)}
          aria-valuenow=${this.currentIndex}
          aria-label="Jog 2-hour radar and cloud history"
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @keydown=${(o) => {
      o.key === "ArrowLeft" ? (o.preventDefault(), this.dispatchEvent(
        new CustomEvent("jog-step", { detail: { delta: -1 }, bubbles: !0, composed: !0 })
      )) : o.key === "ArrowRight" && (o.preventDefault(), this.dispatchEvent(
        new CustomEvent("jog-step", { detail: { delta: 1 }, bubbles: !0, composed: !0 })
      ));
    }}
        >
          <div class="ticks">
            ${this.timeline.map((o, n) => {
      const h = n === this.currentIndex ? "tick current" : n < this.currentIndex ? "tick past-active" : this.readySlots[n] ? "tick ready" : "tick";
      return v`<div class=${h}></div>`;
    })}
          </div>
          <div class="thumb" style="left: ${i}%;"></div>
        </div>

        <div class="scale-labels">
          <span>${a ? this.formatRelative(a.offset_minutes) : "-2h"}</span>
          <span>-1h</span>
          <span>Now</span>
        </div>
      </div>
    `;
  }
};
Tt.styles = At`
    :host {
      display: block;
      user-select: none;
      -webkit-user-select: none;
    }

    .bar {
      --bar-bg: rgba(15, 23, 42, 0.92);
      --bar-border: rgba(148, 163, 184, 0.2);
      --bar-text: #f8fafc;
      --bar-muted: #94a3b8;
      --ctrl-bg: rgba(30, 41, 59, 0.88);
      --ctrl-hover: rgba(51, 65, 85, 0.95);
      --ctrl-border: rgba(148, 163, 184, 0.28);
      --ctrl-text: #f1f5f9;
      --track-bg: rgba(30, 41, 59, 0.95);
      --tick-empty: rgba(100, 116, 139, 0.35);
      --tick-ready: rgba(148, 163, 184, 0.58);
      --now-bg: rgba(16, 185, 129, 0.2);
      --now-text: #6ee7b7;
      --now-border: rgba(16, 185, 129, 0.45);
      --past-bg: rgba(245, 158, 11, 0.2);
      --past-text: #fcd34d;
      --past-border: rgba(245, 158, 11, 0.45);

      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 12px 10px;
      background: var(--bar-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-top: 1px solid var(--bar-border);
      color: var(--bar-text);
      font-family: var(--paper-font-body1_-_font-family, system-ui, -apple-system, sans-serif);
    }

    .bar[data-theme="light"] {
      --bar-bg: rgba(248, 250, 252, 0.96);
      --bar-border: rgba(15, 23, 42, 0.12);
      --bar-text: #0f172a;
      --bar-muted: #64748b;
      --ctrl-bg: #ffffff;
      --ctrl-hover: #f1f5f9;
      --ctrl-border: rgba(15, 23, 42, 0.18);
      --ctrl-text: #0f172a;
      --track-bg: rgba(226, 232, 240, 0.95);
      --tick-empty: rgba(148, 163, 184, 0.4);
      --tick-ready: rgba(100, 116, 139, 0.55);
      --now-bg: rgba(16, 185, 129, 0.15);
      --now-text: #047857;
      --now-border: rgba(16, 185, 129, 0.4);
      --past-bg: rgba(245, 158, 11, 0.16);
      --past-text: #b45309;
      --past-border: rgba(245, 158, 11, 0.42);
    }

    .top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .transport {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    button.ctrl {
      appearance: none;
      border: 1px solid var(--ctrl-border);
      background: var(--ctrl-bg);
      color: var(--ctrl-text);
      border-radius: 8px;
      height: 30px;
      min-width: 30px;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: background 0.14s ease, border-color 0.14s ease, transform 0.08s ease;
    }

    button.ctrl:hover {
      background: var(--ctrl-hover);
      border-color: rgba(2, 132, 199, 0.65);
    }

    button.ctrl:active {
      transform: scale(0.96);
    }

    button.play-btn {
      background: #0284c7;
      border-color: #0284c7;
      color: #ffffff;
      min-width: 36px;
    }

    button.play-btn:hover {
      background: #0369a1;
      border-color: #0369a1;
    }

    .time-readout {
      display: flex;
      align-items: center;
      gap: 8px;
      font-variant-numeric: tabular-nums;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--bar-text);
    }

    .offset-badge {
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .offset-now {
      background: var(--now-bg);
      color: var(--now-text);
      border: 1px solid var(--now-border);
    }

    .offset-past {
      background: var(--past-bg);
      color: var(--past-text);
      border: 1px solid var(--past-border);
    }

    .scrubber-wrap {
      position: relative;
      height: 24px;
      display: flex;
      align-items: center;
      cursor: ew-resize;
      touch-action: none;
    }

    .ticks {
      width: 100%;
      height: 7px;
      border-radius: 999px;
      background: var(--track-bg);
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 2px;
      padding: 1px;
      overflow: hidden;
      border: 1px solid var(--bar-border);
    }

    .tick {
      height: 100%;
      border-radius: 3px;
      background: var(--tick-empty);
      transition: background 0.12s ease;
    }

    .tick.ready {
      background: var(--tick-ready);
    }

    .tick.past-active {
      background: rgba(2, 132, 199, 0.72);
    }

    .tick.current {
      background: #0ea5e9;
    }

    .thumb {
      position: absolute;
      top: 50%;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: #ffffff;
      border: 2.5px solid #0284c7;
      box-shadow: 0 1px 6px rgba(15, 23, 42, 0.45);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: var(--bar-muted);
      font-variant-numeric: tabular-nums;
      margin-top: -2px;
    }
  `;
let P = Tt;
j([
  M({ type: Array })
], P.prototype, "timeline");
j([
  M({ type: Array })
], P.prototype, "readySlots");
j([
  M({ type: Number })
], P.prototype, "currentIndex");
j([
  M({ type: Boolean })
], P.prototype, "playing");
j([
  M({ type: Number })
], P.prototype, "speed");
j([
  M({ type: String })
], P.prototype, "timeZone");
j([
  M({ type: Boolean })
], P.prototype, "dark");
Lt("solar-sky-jog-slider", P);
function pt(s) {
  return s.autoplay_mode === "off" || s.autoplay_mode === "once" || s.autoplay_mode === "loop" ? s.autoplay_mode : s.autoplay_once ? "once" : s.autoplay ? "loop" : "off";
}
var Te = Object.defineProperty, de = (s, t, e, i) => {
  for (var r = void 0, a = s.length - 1, o; a >= 0; a--)
    (o = s[a]) && (r = o(t, e, r) || r);
  return r && Te(t, e, r), r;
};
const Rt = class Rt extends D {
  constructor() {
    super(...arguments), this.config = {
      type: "custom:solar-sky-radar-card"
    };
  }
  setConfig(t) {
    const e = t ?? {};
    this.config = {
      ...e,
      type: e.type ?? "custom:solar-sky-radar-card"
    };
  }
  emitConfig(t) {
    this.config = t, this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: t },
        bubbles: !0,
        composed: !0
      })
    );
  }
  updateField(t, e) {
    this.emitConfig({ ...this.config, [t]: e });
  }
  updateAutoplayMode(t) {
    const e = {
      ...this.config,
      autoplay_mode: t,
      autoplay: t === "loop",
      autoplay_once: t === "once"
    };
    this.emitConfig(e);
  }
  render() {
    const t = this.config, e = pt(t);
    return v`
      <div class="section">
        <div class="section-title">Map & Location</div>
        <div class="grid">
          <label class="field">
            <span>Card Title (optional)</span>
            <input
              type="text"
              .value=${t.title ?? ""}
              placeholder="Melbourne Solar Sky"
              @input=${(i) => this.updateField("title", i.target.value)}
            />
          </label>
          <label class="field">
            <span>Basemap Style</span>
            <select
              .value=${t.basemap_theme ?? "auto"}
              @change=${(i) => this.updateField(
      "basemap_theme",
      i.target.value
    )}
            >
              <option value="auto">Auto (Follow HA Dark/Light)</option>
              <option value="dark">Vector Dark (Labels Above Clouds)</option>
              <option value="light">Vector Light (Labels Above Clouds)</option>
              <option value="bom_dark">BOM Native Dark (Australia)</option>
              <option value="bom_light">BOM Native Light (Australia)</option>
            </select>
          </label>
          <label class="field">
            <span>Initial Zoom (4 - 11)</span>
            <input
              type="number"
              min="4"
              max="11"
              step="0.2"
              .value=${String(t.zoom_level ?? 7.2)}
              @change=${(i) => this.updateField(
      "zoom_level",
      Number(i.target.value)
    )}
            />
          </label>
          <label class="field">
            <span>Map Height (px)</span>
            <input
              type="number"
              min="280"
              max="960"
              step="10"
              .value=${String(t.map_height ?? 490)}
              @change=${(i) => this.updateField(
      "map_height",
      Number(i.target.value)
    )}
            />
          </label>
        </div>
        <label class="toggle" style="margin-top: 6px;">
          <span>Lock Map to Centre by Default (Mobile-Friendly Page Scroll)</span>
          <input
            type="checkbox"
            .checked=${t.lock_map ?? !0}
            @change=${(i) => this.updateField("lock_map", i.target.checked)}
          />
        </label>
      </div>

      <div class="section">
        <div class="section-title">Satellite, Solar Cloud & Weather Overlays</div>
        <label class="toggle">
          <span>Satellite Visible True Colour (Himawari-9 / Global GeoColor)</span>
          <input
            type="checkbox"
            .checked=${t.show_true_colour ?? !0}
            @change=${(i) => this.updateField("show_true_colour", i.target.checked)}
          />
        </label>
        <label class="field" style="margin-bottom: 8px;">
          <span>True Colour Opacity (${Math.round((t.true_colour_opacity ?? 1) * 100)}%)</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            .value=${String(t.true_colour_opacity ?? 1)}
            @input=${(i) => this.updateField(
      "true_colour_opacity",
      Number(i.target.value)
    )}
          />
        </label>

        <label class="toggle">
          <span>Visual Cloud Overlay (Solar Prediction Layer)</span>
          <input
            type="checkbox"
            .checked=${t.show_cloud_overlay ?? !1}
            @change=${(i) => this.updateField(
      "show_cloud_overlay",
      i.target.checked
    )}
          />
        </label>
        <div class="grid" style="margin-bottom: 8px;">
          <label class="field">
            <span>Cloud Overlay Mode</span>
            <select
              .value=${t.cloud_mode ?? "solar_cloud"}
              @change=${(i) => this.updateField(
      "cloud_mode",
      i.target.value
    )}
            >
              <option value="solar_cloud">
                Solar Classification (Cirrus / Patchy / Storm)
              </option>
              <option value="cloud_mask">Clean Visual Cloud Mask</option>
            </select>
          </label>
          <label class="field">
            <span>Cloud Opacity (${Math.round((t.cloud_opacity ?? 0.58) * 100)}%)</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              .value=${String(t.cloud_opacity ?? 0.58)}
              @input=${(i) => this.updateField(
      "cloud_opacity",
      Number(i.target.value)
    )}
            />
          </label>
        </div>

        <label class="toggle">
          <span>Rain Radar Overlay (BOM 5-min / RainViewer)</span>
          <input
            type="checkbox"
            .checked=${t.show_radar ?? !0}
            @change=${(i) => this.updateField("show_radar", i.target.checked)}
          />
        </label>

        <label class="toggle">
          <span>Animated Wind Streamlines</span>
          <input
            type="checkbox"
            .checked=${t.show_wind ?? !0}
            @change=${(i) => this.updateField("show_wind", i.target.checked)}
          />
        </label>
        <label class="field" style="margin-bottom: 8px;">
          <span>Wind Streamline Altitude</span>
          <select
            .value=${t.wind_level ?? "850hPa"}
            @change=${(i) => this.updateField(
      "wind_level",
      i.target.value
    )}
          >
            <option value="850hPa">
              850 hPa Cloud-Steering Wind (~1.5 km, best for approaching clouds)
            </option>
            <option value="10m">10 m Surface Wind</option>
          </select>
        </label>

        <label class="toggle">
          <span>Time-Synced Blitzortung Lightning Strikes</span>
          <input
            type="checkbox"
            .checked=${t.show_lightning ?? !0}
            @change=${(i) => this.updateField("show_lightning", i.target.checked)}
          />
        </label>

        <label class="toggle">
          <span>NASA FIRMS & DEA Bushfire Hotspots</span>
          <input
            type="checkbox"
            .checked=${t.show_fires ?? !0}
            @change=${(i) => this.updateField("show_fires", i.target.checked)}
          />
        </label>

        <label class="toggle">
          <span>Upwind Solar Arrival Arcs (15m / 30m / 60m)</span>
          <input
            type="checkbox"
            .checked=${t.show_solar_rings ?? !0}
            @change=${(i) => this.updateField(
      "show_solar_rings",
      i.target.checked
    )}
          />
        </label>

        <label class="toggle">
          <span>Solar Sky Nowcast HUD Banner</span>
          <input
            type="checkbox"
            .checked=${t.show_solar_hud ?? !0}
            @change=${(i) => this.updateField("show_solar_hud", i.target.checked)}
          />
        </label>

        <label class="field" style="margin-top: 8px;">
          <span>2-Hour Playback When Visible (&ge;75% on Screen)</span>
          <select
            .value=${e}
            @change=${(i) => this.updateAutoplayMode(
      i.target.value
    )}
          >
            <option value="off">Off (Manual Play / Scrub)</option>
            <option value="once">
              Single Play 2-Hour Loop When Shown (Plays Once to Live)
            </option>
            <option value="loop">
              Continuous 2-Hour Loop While Visible
            </option>
          </select>
          <span class="field-hint">
            Triggers automatically once scrolling uncovers at least 75% of the map, and pauses when scrolled off-screen.
          </span>
        </label>
      </div>
    `;
  }
};
Rt.styles = At`
    :host {
      display: block;
      font-family: var(--paper-font-body1_-_font-family, system-ui, sans-serif);
      color: var(--primary-text-color, #1e293b);
    }

    .section {
      margin-bottom: 16px;
      padding: 14px;
      border-radius: 12px;
      background: var(--secondary-background-color, rgba(148, 163, 184, 0.12));
      border: 1px solid var(--divider-color, rgba(148, 163, 184, 0.3));
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
      padding-left: 8px;
      border-left: 3px solid var(--primary-color, #0284c7);
      color: var(--primary-text-color, #0f172a);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }

    label.field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--primary-text-color, #1e293b);
    }

    .field-hint {
      font-size: 11px;
      font-weight: 400;
      color: var(--secondary-text-color, #64748b);
    }

    label.toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      font-size: 13px;
      color: var(--primary-text-color, #1e293b);
      cursor: pointer;
    }

    input[type="text"],
    input[type="number"],
    select {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--divider-color, rgba(100, 116, 139, 0.45));
      background: var(--card-background-color, var(--ha-card-background, #ffffff));
      color: var(--primary-text-color, #0f172a);
      font-size: 13px;
      outline: none;
      transition: border-color 0.14s ease, box-shadow 0.14s ease;
    }

    input[type="text"]::placeholder {
      color: var(--secondary-text-color, #64748b);
      opacity: 0.85;
    }

    input[type="text"]:focus,
    input[type="number"]:focus,
    select:focus {
      border-color: var(--primary-color, #0284c7);
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18);
    }

    select option {
      background: var(--card-background-color, var(--ha-card-background, #ffffff));
      color: var(--primary-text-color, #0f172a);
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary-color, #0284c7);
      cursor: pointer;
      flex-shrink: 0;
    }

    input[type="range"] {
      width: 100%;
      accent-color: var(--primary-color, #0284c7);
    }
  `;
let lt = Rt;
de([
  M({ attribute: !1 })
], lt.prototype, "hass");
de([
  $()
], lt.prototype, "config");
Lt("solar-sky-radar-card-editor", lt);
const Re = `.maplibregl-map{font:12px/20px Helvetica Neue,Arial,Helvetica,sans-serif;overflow:hidden;position:relative;-webkit-tap-highlight-color:rgb(0 0 0/0);-webkit-touch-callout:none}.maplibregl-canvas{position:absolute;left:0;top:0}.maplibregl-map:fullscreen{width:100%;height:100%}.maplibregl-ctrl-group button.maplibregl-ctrl-compass{touch-action:none}.maplibregl-canvas-container.maplibregl-interactive,.maplibregl-ctrl-group button.maplibregl-ctrl-compass{cursor:grab;-webkit-user-select:none;-moz-user-select:none;user-select:none}.maplibregl-canvas-container.maplibregl-interactive.maplibregl-track-pointer{cursor:pointer}.maplibregl-canvas-container.maplibregl-interactive:active,.maplibregl-ctrl-group button.maplibregl-ctrl-compass:active{cursor:grabbing}.maplibregl-canvas-container.maplibregl-touch-zoom-rotate,.maplibregl-canvas-container.maplibregl-touch-zoom-rotate .maplibregl-canvas{touch-action:pan-x pan-y}.maplibregl-canvas-container.maplibregl-touch-drag-pan,.maplibregl-canvas-container.maplibregl-touch-drag-pan .maplibregl-canvas{touch-action:pinch-zoom}.maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan,.maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan .maplibregl-canvas{touch-action:none}.maplibregl-canvas-container.maplibregl-touch-drag-pan.maplibregl-cooperative-gestures,.maplibregl-canvas-container.maplibregl-touch-drag-pan.maplibregl-cooperative-gestures .maplibregl-canvas{touch-action:pan-x pan-y}.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right,.maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{position:absolute;pointer-events:none;z-index:2}.maplibregl-ctrl-top-left{top:0;left:0}.maplibregl-ctrl-top-right{top:0;right:0}.maplibregl-ctrl-bottom-left{bottom:0;left:0}.maplibregl-ctrl-bottom-right{right:0;bottom:0}.maplibregl-ctrl{clear:both;pointer-events:auto;transform:translate(0)}.maplibregl-ctrl-top-left .maplibregl-ctrl{margin:10px 0 0 10px;float:left}.maplibregl-ctrl-top-right .maplibregl-ctrl{margin:10px 10px 0 0;float:right}.maplibregl-ctrl-bottom-left .maplibregl-ctrl{margin:0 0 10px 10px;float:left}.maplibregl-ctrl-bottom-right .maplibregl-ctrl{margin:0 10px 10px 0;float:right}.maplibregl-ctrl-group{border-radius:4px;background:#fff}.maplibregl-ctrl-group:not(:empty){box-shadow:0 0 0 2px #0000001a}.maplibregl-ctrl-group button{width:29px;height:29px;display:block;padding:0;outline:none;border:0;box-sizing:border-box;background-color:transparent;cursor:pointer}.maplibregl-ctrl button{-webkit-user-select:none;-moz-user-select:none;user-select:none}.maplibregl-ctrl-group button+button{border-top:1px solid #ddd}.maplibregl-ctrl button .maplibregl-ctrl-icon{display:block;width:100%;height:100%;background-repeat:no-repeat;background-position:50%}@media(forced-colors:active){.maplibregl-ctrl-group:not(:empty){box-shadow:0 0 0 2px ButtonText}.maplibregl-ctrl-icon{background-color:transparent}.maplibregl-ctrl-group button+button{border-top:1px solid buttontext}}.maplibregl-ctrl button::-moz-focus-inner{border:0;padding:0}.maplibregl-ctrl-attrib-button:focus,.maplibregl-ctrl-group button:focus{box-shadow:0 0 2px 2px #0096ff}.maplibregl-ctrl button:disabled{cursor:not-allowed}.maplibregl-ctrl button:disabled .maplibregl-ctrl-icon{opacity:.25}@media(hover:hover){.maplibregl-ctrl button:not(:disabled):hover{background-color:#0000000d}}.maplibregl-ctrl button:not(:disabled):active{background-color:#0000000d}.maplibregl-ctrl-group button:focus:focus-visible{box-shadow:0 0 2px 2px #0096ff}.maplibregl-ctrl-group button:focus:not(:focus-visible){box-shadow:none}.maplibregl-ctrl-group button:focus:first-child{border-radius:4px 4px 0 0}.maplibregl-ctrl-group button:focus:last-child{border-radius:0 0 4px 4px}.maplibregl-ctrl-group button:focus:only-child{border-radius:inherit}.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23333'%3E %3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23333'%3E %3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5'/%3E %3C/svg%3E")}@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23fff'%3E %3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23fff'%3E %3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5'/%3E %3C/svg%3E")}}@media(forced-colors:active)and (prefers-color-scheme:light){.maplibregl-ctrl button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23000'%3E %3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23000'%3E %3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5'/%3E %3C/svg%3E")}}.maplibregl-ctrl button.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23333'%3E %3Cpath d='M24 16v5.5c0 1.75-.75 2.5-2.5 2.5H16v-1l3-1.5-4-5.5 1-1 5.5 4 1.5-3zM6 16l1.5 3 5.5-4 1 1-4 5.5 3 1.5v1H7.5C5.75 24 5 23.25 5 21.5V16zm7-11v1l-3 1.5 4 5.5-1 1-5.5-4L6 13H5V7.5C5 5.75 5.75 5 7.5 5zm11 2.5c0-1.75-.75-2.5-2.5-2.5H16v1l3 1.5-4 5.5 1 1 5.5-4 1.5 3h1z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-shrink .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29'%3E %3Cpath d='M18.5 16c-1.75 0-2.5.75-2.5 2.5V24h1l1.5-3 5.5 4 1-1-4-5.5 3-1.5v-1zM13 18.5c0-1.75-.75-2.5-2.5-2.5H5v1l3 1.5L4 24l1 1 5.5-4 1.5 3h1zm3-8c0 1.75.75 2.5 2.5 2.5H24v-1l-3-1.5L25 5l-1-1-5.5 4L17 5h-1zM10.5 13c1.75 0 2.5-.75 2.5-2.5V5h-1l-1.5 3L5 4 4 5l4 5.5L5 12v1z'/%3E %3C/svg%3E")}@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23fff'%3E %3Cpath d='M24 16v5.5c0 1.75-.75 2.5-2.5 2.5H16v-1l3-1.5-4-5.5 1-1 5.5 4 1.5-3zM6 16l1.5 3 5.5-4 1 1-4 5.5 3 1.5v1H7.5C5.75 24 5 23.25 5 21.5V16zm7-11v1l-3 1.5 4 5.5-1 1-5.5-4L6 13H5V7.5C5 5.75 5.75 5 7.5 5zm11 2.5c0-1.75-.75-2.5-2.5-2.5H16v1l3 1.5-4 5.5 1 1 5.5-4 1.5 3h1z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-shrink .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23fff'%3E %3Cpath d='M18.5 16c-1.75 0-2.5.75-2.5 2.5V24h1l1.5-3 5.5 4 1-1-4-5.5 3-1.5v-1zM13 18.5c0-1.75-.75-2.5-2.5-2.5H5v1l3 1.5L4 24l1 1 5.5-4 1.5 3h1zm3-8c0 1.75.75 2.5 2.5 2.5H24v-1l-3-1.5L25 5l-1-1-5.5 4L17 5h-1zM10.5 13c1.75 0 2.5-.75 2.5-2.5V5h-1l-1.5 3L5 4 4 5l4 5.5L5 12v1z'/%3E %3C/svg%3E")}}@media(forced-colors:active)and (prefers-color-scheme:light){.maplibregl-ctrl button.maplibregl-ctrl-fullscreen .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23000'%3E %3Cpath d='M24 16v5.5c0 1.75-.75 2.5-2.5 2.5H16v-1l3-1.5-4-5.5 1-1 5.5 4 1.5-3zM6 16l1.5 3 5.5-4 1 1-4 5.5 3 1.5v1H7.5C5.75 24 5 23.25 5 21.5V16zm7-11v1l-3 1.5 4 5.5-1 1-5.5-4L6 13H5V7.5C5 5.75 5.75 5 7.5 5zm11 2.5c0-1.75-.75-2.5-2.5-2.5H16v1l3 1.5-4 5.5 1 1 5.5-4 1.5 3h1z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-shrink .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23000'%3E %3Cpath d='M18.5 16c-1.75 0-2.5.75-2.5 2.5V24h1l1.5-3 5.5 4 1-1-4-5.5 3-1.5v-1zM13 18.5c0-1.75-.75-2.5-2.5-2.5H5v1l3 1.5L4 24l1 1 5.5-4 1.5 3h1zm3-8c0 1.75.75 2.5 2.5 2.5H24v-1l-3-1.5L25 5l-1-1-5.5 4L17 5h-1zM10.5 13c1.75 0 2.5-.75 2.5-2.5V5h-1l-1.5 3L5 4 4 5l4 5.5L5 12v1z'/%3E %3C/svg%3E")}}.maplibregl-ctrl button.maplibregl-ctrl-compass .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23333'%3E %3Cpath d='m10.5 14 4-8 4 8z'/%3E %3Cpath fill='%23ccc' d='m10.5 16 4 8 4-8z'/%3E %3C/svg%3E")}@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-compass .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23fff'%3E %3Cpath d='m10.5 14 4-8 4 8z'/%3E %3Cpath fill='%23ccc' d='m10.5 16 4 8 4-8z'/%3E %3C/svg%3E")}}@media(forced-colors:active)and (prefers-color-scheme:light){.maplibregl-ctrl button.maplibregl-ctrl-compass .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 29 29' fill='%23000'%3E %3Cpath d='m10.5 14 4-8 4 8z'/%3E %3Cpath fill='%23ccc' d='m10.5 16 4 8 4-8z'/%3E %3C/svg%3E")}}.maplibregl-ctrl button.maplibregl-ctrl-globe .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='none' viewBox='0 0 22 22' stroke='%23333'%3E %3Ccircle cx='11' cy='11' r='8.5'/%3E %3Cpath d='M17.5 11c0 4.819-3.02 8.5-6.5 8.5S4.5 15.819 4.5 11 7.52 2.5 11 2.5s6.5 3.681 6.5 8.5Z'/%3E %3Cpath d='M13.5 11c0 2.447-.331 4.64-.853 6.206-.262.785-.562 1.384-.872 1.777-.314.399-.58.517-.775.517-.195 0-.461-.118-.775-.517-.31-.393-.61-.992-.872-1.777C8.831 15.64 8.5 13.446 8.5 11c0-2.447.331-4.64.853-6.206.262-.785.562-1.384.872-1.777.314-.399.58-.517.775-.517.195 0 .461.118.775.517.31.393.61.992.872 1.777.522 1.565.853 3.76.853 6.206Z'/%3E %3Cpath d='M11 7.5c-1.909 0-3.622-.166-4.845-.428-.616-.132-1.08-.283-1.379-.434a1.333 1.333 0 0 1-.224-.138c.047-.038.12-.085.224-.138.299-.151.763-.302 1.379-.434C7.378 5.666 9.091 5.5 11 5.5c1.909 0 3.622.166 4.845.428.616.132 1.08.283 1.379.434.105.053.177.1.224.138-.047.038-.12.085-.224.138-.299.151-.763.302-1.379.434-1.223.262-2.936.428-4.845.428ZM4.486 6.436ZM11 16.5c-1.909 0-3.622-.166-4.845-.428-.616-.132-1.08-.283-1.379-.434a1.33 1.33 0 0 1-.224-.138 1.33 1.33 0 0 1 .224-.138c.299-.151.763-.302 1.379-.434C7.378 14.666 9.091 14.5 11 14.5c1.909 0 3.622.166 4.845.428.616.132 1.08.283 1.379.434.105.053.177.1.224.138a1.33 1.33 0 0 1-.224.138c-.299.151-.763.302-1.379.434-1.223.262-2.936.428-4.845.428Zm-6.514-1.064ZM11 12.5c-2.46 0-4.672-.222-6.255-.574-.796-.177-1.406-.38-1.805-.59a1.465 1.465 0 0 1-.39-.272.293.293 0 0 1-.047-.064.293.293 0 0 1 .048-.064c.066-.073.189-.167.389-.272.399-.21 1.009-.413 1.805-.59C6.328 9.722 8.54 9.5 11 9.5s4.672.222 6.256.574c.795.177 1.405.38 1.804.59.2.105.323.2.39.272a.33.33 0 0 1 .047.064.293.293 0 0 1-.048.064 1.435 1.435 0 0 1-.389.272c-.399.21-1.009.413-1.804.59-1.584.352-3.796.574-6.256.574Zm-8.501-1.51v.002-.002Zm0 .018v.002-.002Zm17.002.002v-.002.002Zm0-.018v-.002.002Z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-globe-enabled .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' fill='none' viewBox='0 0 22 22' stroke='%2333b5e5'%3E %3Ccircle cx='11' cy='11' r='8.5'/%3E %3Cpath d='M17.5 11c0 4.819-3.02 8.5-6.5 8.5S4.5 15.819 4.5 11 7.52 2.5 11 2.5s6.5 3.681 6.5 8.5Z'/%3E %3Cpath d='M13.5 11c0 2.447-.331 4.64-.853 6.206-.262.785-.562 1.384-.872 1.777-.314.399-.58.517-.775.517-.195 0-.461-.118-.775-.517-.31-.393-.61-.992-.872-1.777C8.831 15.64 8.5 13.446 8.5 11c0-2.447.331-4.64.853-6.206.262-.785.562-1.384.872-1.777.314-.399.58-.517.775-.517.195 0 .461.118.775.517.31.393.61.992.872 1.777.522 1.565.853 3.76.853 6.206Z'/%3E %3Cpath d='M11 7.5c-1.909 0-3.622-.166-4.845-.428-.616-.132-1.08-.283-1.379-.434a1.333 1.333 0 0 1-.224-.138c.047-.038.12-.085.224-.138.299-.151.763-.302 1.379-.434C7.378 5.666 9.091 5.5 11 5.5c1.909 0 3.622.166 4.845.428.616.132 1.08.283 1.379.434.105.053.177.1.224.138-.047.038-.12.085-.224.138-.299.151-.763.302-1.379.434-1.223.262-2.936.428-4.845.428ZM4.486 6.436ZM11 16.5c-1.909 0-3.622-.166-4.845-.428-.616-.132-1.08-.283-1.379-.434a1.33 1.33 0 0 1-.224-.138 1.33 1.33 0 0 1 .224-.138c.299-.151.763-.302 1.379-.434C7.378 14.666 9.091 14.5 11 14.5c1.909 0 3.622.166 4.845.428.616.132 1.08.283 1.379.434.105.053.177.1.224.138a1.33 1.33 0 0 1-.224.138c-.299.151-.763.302-1.379.434-1.223.262-2.936.428-4.845.428Zm-6.514-1.064ZM11 12.5c-2.46 0-4.672-.222-6.255-.574-.796-.177-1.406-.38-1.805-.59a1.465 1.465 0 0 1-.39-.272.293.293 0 0 1-.047-.064.293.293 0 0 1 .048-.064c.066-.073.189-.167.389-.272.399-.21 1.009-.413 1.805-.59C6.328 9.722 8.54 9.5 11 9.5s4.672.222 6.256.574c.795.177 1.405.38 1.804.59.2.105.323.2.39.272a.33.33 0 0 1 .047.064.293.293 0 0 1-.048.064 1.435 1.435 0 0 1-.389.272c-.399.21-1.009.413-1.804.59-1.584.352-3.796.574-6.256.574Zm-8.501-1.51v.002-.002Zm0 .018v.002-.002Zm17.002.002v-.002.002Zm0-.018v-.002.002Z'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-terrain .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22' fill='%23333'%3E %3Cpath d='m1.754 13.406 4.453-4.851 3.09 3.09 3.281 3.277.969-.969-3.309-3.312 3.844-4.121 6.148 6.886h1.082v-.855l-7.207-8.07-4.84 5.187L6.169 6.57l-5.48 5.965v.871ZM.688 16.844h20.625v1.375H.688Zm0 0'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-terrain-enabled .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22' fill='%2333b5e5'%3E %3Cpath d='m1.754 13.406 4.453-4.851 3.09 3.09 3.281 3.277.969-.969-3.309-3.312 3.844-4.121 6.148 6.886h1.082v-.855l-7.207-8.07-4.84 5.187L6.169 6.57l-5.48 5.965v.871ZM.688 16.844h20.625v1.375H.688Zm0 0'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23333'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate:disabled .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23aaa'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' fill='%23f00'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%2333b5e5'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active-error .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23e58978'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%2333b5e5'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2' display='none'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background-error .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23e54e33'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2' display='none'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-waiting .maplibregl-ctrl-icon{animation:maplibregl-spin 2s linear infinite}@media(forced-colors:active){.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23fff'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate:disabled .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23999'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' fill='%23f00'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%2333b5e5'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-active-error .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23e58978'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%2333b5e5'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2' display='none'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate.maplibregl-ctrl-geolocate-background-error .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23e54e33'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2' display='none'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}}@media(forced-colors:active)and (prefers-color-scheme:light){.maplibregl-ctrl button.maplibregl-ctrl-geolocate .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23000'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' display='none'/%3E %3C/svg%3E")}.maplibregl-ctrl button.maplibregl-ctrl-geolocate:disabled .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='29' height='29' viewBox='0 0 20 20' fill='%23666'%3E %3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7'/%3E %3Ccircle id='dot' cx='10' cy='10' r='2'/%3E %3Cpath id='stroke' d='m14 5 1 1-9 9-1-1z' fill='%23f00'/%3E %3C/svg%3E")}}@keyframes maplibregl-spin{0%{transform:rotate(0)}to{transform:rotate(1turn)}}a.maplibregl-ctrl-logo{width:88px;height:23px;margin:0 0 -4px -4px;display:block;background-repeat:no-repeat;cursor:pointer;overflow:hidden;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='23' fill='none'%3E %3Cpath fill='%23000' fill-opacity='.4' fill-rule='evenodd' d='M17.408 16.796h-1.827l2.501-12.095h.198l3.324 6.533.988 2.19.988-2.19 3.258-6.533h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.929 5.644h-.098l-2.914-5.644-.757-1.71-.345 1.71zm1.958-3.42-.726 3.663a1.255 1.255 0 0 1-1.232 1.011h-1.827a1.255 1.255 0 0 1-1.229-1.509l2.501-12.095a1.255 1.255 0 0 1 1.23-1.001h.197a1.25 1.25 0 0 1 1.12.685l3.19 6.273 3.125-6.263a1.25 1.25 0 0 1 1.123-.695h.181a1.255 1.255 0 0 1 1.227.991l1.443 6.71a5 5 0 0 1 .314-.787l.009-.016a4.6 4.6 0 0 1 1.777-1.887c.782-.46 1.668-.667 2.611-.667a4.6 4.6 0 0 1 1.7.32l.306.134c.21-.16.474-.256.759-.256h1.694a1.255 1.255 0 0 1 1.212.925 1.255 1.255 0 0 1 1.212-.925h1.711c.284 0 .545.094.755.252.613-.3 1.312-.45 2.075-.45 1.356 0 2.557.445 3.482 1.4q.47.48.763 1.064V4.701a1.255 1.255 0 0 1 1.255-1.255h1.86A1.255 1.255 0 0 1 54.44 4.7v9.194h2.217c.19 0 .37.043.532.118v-4.77c0-.356.147-.678.385-.906a2.42 2.42 0 0 1-.682-1.71c0-.665.267-1.253.735-1.7a2.45 2.45 0 0 1 1.722-.674 2.43 2.43 0 0 1 1.705.675q.318.302.504.683V4.7a1.255 1.255 0 0 1 1.255-1.255h1.744A1.255 1.255 0 0 1 65.812 4.7v3.335a4.8 4.8 0 0 1 1.526-.246c.938 0 1.817.214 2.59.69a4.47 4.47 0 0 1 1.67 1.743v-.98a1.255 1.255 0 0 1 1.256-1.256h1.777c.233 0 .451.064.639.174a3.4 3.4 0 0 1 1.567-.372c.346 0 .861.02 1.285.232a1.25 1.25 0 0 1 .689 1.004 4.7 4.7 0 0 1 .853-.588c.795-.44 1.675-.647 2.61-.647 1.385 0 2.65.39 3.525 1.396.836.938 1.168 2.173 1.168 3.528q-.001.515-.056 1.051a1.255 1.255 0 0 1-.947 1.09l.408.952a1.255 1.255 0 0 1-.477 1.552c-.418.268-.92.463-1.458.612-.613.171-1.304.244-2.049.244-1.06 0-2.043-.207-2.886-.698l-.015-.008c-.798-.48-1.419-1.135-1.818-1.963l-.004-.008a5.8 5.8 0 0 1-.548-2.512q0-.429.053-.843a1.3 1.3 0 0 1-.333-.086l-.166-.004c-.223 0-.426.062-.643.228-.03.024-.142.139-.142.59v3.883a1.255 1.255 0 0 1-1.256 1.256h-1.777a1.255 1.255 0 0 1-1.256-1.256V15.69l-.032.057a4.8 4.8 0 0 1-1.86 1.833 5.04 5.04 0 0 1-2.484.634 4.5 4.5 0 0 1-1.935-.424 1.25 1.25 0 0 1-.764.258h-1.71a1.255 1.255 0 0 1-1.256-1.255V7.687a2.4 2.4 0 0 1-.428.625c.253.23.412.561.412.93v7.553a1.255 1.255 0 0 1-1.256 1.255h-1.843a1.25 1.25 0 0 1-.894-.373c-.228.23-.544.373-.894.373H51.32a1.255 1.255 0 0 1-1.256-1.255v-1.251l-.061.117a4.7 4.7 0 0 1-1.782 1.884 4.77 4.77 0 0 1-2.485.67 5.6 5.6 0 0 1-1.485-.188l.009 2.764a1.255 1.255 0 0 1-1.255 1.259h-1.729a1.255 1.255 0 0 1-1.255-1.255v-3.537a1.255 1.255 0 0 1-1.167.793h-1.679a1.25 1.25 0 0 1-.77-.263 4.5 4.5 0 0 1-1.945.429c-.885 0-1.724-.21-2.495-.632l-.017-.01a5 5 0 0 1-1.081-.836 1.255 1.255 0 0 1-1.254 1.312h-1.81a1.255 1.255 0 0 1-1.228-.99l-.782-3.625-2.044 3.939a1.25 1.25 0 0 1-1.115.676h-.098a1.25 1.25 0 0 1-1.116-.68l-2.061-3.994zM35.92 16.63l.207-.114.223-.15q.493-.356.735-.785l.061-.118.033 1.332h1.678V9.242h-1.694l-.033 1.267q-.133-.329-.526-.658l-.032-.028a3.2 3.2 0 0 0-.668-.428l-.27-.12a3.3 3.3 0 0 0-1.235-.23q-1.136-.001-1.974.493a3.36 3.36 0 0 0-1.3 1.382q-.445.89-.444 2.074 0 1.2.51 2.107a3.8 3.8 0 0 0 1.382 1.381 3.9 3.9 0 0 0 1.893.477q.795 0 1.455-.33zm-2.789-5.38q-.576.675-.575 1.762 0 1.102.559 1.794.576.675 1.645.675a2.25 2.25 0 0 0 .934-.19 2.2 2.2 0 0 0 .468-.29l.178-.161a2.2 2.2 0 0 0 .397-.561q.244-.5.244-1.15v-.115q0-.708-.296-1.267l-.043-.077a2.2 2.2 0 0 0-.633-.709l-.13-.086-.047-.028a2.1 2.1 0 0 0-1.073-.285q-1.052 0-1.629.692zm2.316 2.706c.163-.17.28-.407.28-.83v-.114c0-.292-.06-.508-.15-.68a.96.96 0 0 0-.353-.389.85.85 0 0 0-.464-.127c-.4 0-.56.114-.664.239l-.01.012c-.148.174-.275.45-.275.945 0 .506.122.801.27.99.097.11.266.224.68.224.303 0 .504-.09.687-.269zm7.545 1.705a2.6 2.6 0 0 0 .331.423q.319.33.755.548l.173.074q.65.255 1.49.255 1.02 0 1.844-.493a3.45 3.45 0 0 0 1.316-1.4q.493-.904.493-2.089 0-1.909-.988-2.913-.988-1.02-2.584-1.02-.898 0-1.575.347a3 3 0 0 0-.415.262l-.199.166a3.4 3.4 0 0 0-.64.82V9.242h-1.712v11.553h1.729l-.017-5.134zm.53-1.138q.206.29.48.5l.155.11.053.034q.51.296 1.119.297 1.07 0 1.645-.675.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.435 0-.835.16a2 2 0 0 0-.284.136 2 2 0 0 0-.363.254 2.2 2.2 0 0 0-.46.569l-.082.162a2.6 2.6 0 0 0-.213 1.072v.115q0 .707.296 1.267l.135.211zm.964-.818a1.1 1.1 0 0 0 .367.385.94.94 0 0 0 .476.118c.423 0 .59-.117.687-.23.159-.194.28-.478.28-.95 0-.53-.133-.8-.266-.952l-.021-.025c-.078-.094-.231-.221-.68-.221a1 1 0 0 0-.503.135l-.012.007a.86.86 0 0 0-.335.343c-.073.133-.132.324-.132.614v.115a1.4 1.4 0 0 0 .14.66zm15.7-6.222q.347-.346.346-.856a1.05 1.05 0 0 0-.345-.79 1.18 1.18 0 0 0-.84-.329q-.51 0-.855.33a1.05 1.05 0 0 0-.346.79q0 .51.346.855.345.346.856.346.51 0 .839-.346zm4.337 9.314.033-1.332q.191.403.59.747l.098.081a4 4 0 0 0 .316.224l.223.122a3.2 3.2 0 0 0 1.44.322 3.8 3.8 0 0 0 1.875-.477 3.5 3.5 0 0 0 1.382-1.366q.527-.89.526-2.09 0-1.184-.444-2.073a3.24 3.24 0 0 0-1.283-1.399q-.823-.51-1.942-.51a3.5 3.5 0 0 0-1.527.344l-.086.043-.165.09a3 3 0 0 0-.33.214q-.432.315-.656.707a2 2 0 0 0-.099.198l.082-1.283V4.701h-1.744v12.095zm.473-2.509a2.5 2.5 0 0 0 .566.7q.117.098.245.18l.144.08a2.1 2.1 0 0 0 .975.232q1.07 0 1.645-.675.576-.69.576-1.778 0-1.102-.576-1.777-.56-.691-1.645-.692a2.2 2.2 0 0 0-1.015.235q-.22.113-.415.282l-.15.142a2.1 2.1 0 0 0-.42.594q-.223.479-.223 1.1v.115q0 .705.293 1.26zm2.616-.293c.157-.191.28-.479.28-.967 0-.51-.13-.79-.276-.961l-.021-.026c-.082-.1-.232-.225-.67-.225a.87.87 0 0 0-.681.279l-.012.011c-.154.155-.274.38-.274.807v.115c0 .285.057.499.144.669a1.1 1.1 0 0 0 .367.405c.137.082.28.123.455.123.423 0 .59-.118.686-.23zm8.266-3.013q.345-.13.724-.14l.069-.002q.493 0 .642.099l.247-1.794q-.196-.099-.717-.099a2.3 2.3 0 0 0-.545.063 2 2 0 0 0-.411.148 2.2 2.2 0 0 0-.4.249 2.5 2.5 0 0 0-.485.499 2.7 2.7 0 0 0-.32.581l-.05.137v-1.48h-1.778v7.553h1.777v-3.884q0-.546.159-.943a1.5 1.5 0 0 1 .466-.636 2.5 2.5 0 0 1 .399-.253 2 2 0 0 1 .224-.099zm9.784 2.656.05-.922q0-1.743-.856-2.698-.838-.97-2.584-.97-1.119-.001-2.007.493a3.46 3.46 0 0 0-1.4 1.382q-.493.906-.493 2.106 0 1.07.428 1.975.428.89 1.332 1.432.906.526 2.255.526.973 0 1.668-.185l.044-.012.135-.04q.613-.184.984-.421l-.542-1.267q-.3.162-.642.274l-.297.087q-.51.131-1.3.131-.954 0-1.497-.444a1.6 1.6 0 0 1-.192-.193q-.366-.44-.512-1.234l-.004-.021zm-5.427-1.256-.003.022h3.752v-.138q-.011-.727-.288-1.118a1 1 0 0 0-.156-.176q-.46-.428-1.316-.428-.986 0-1.494.604-.379.45-.494 1.234zm-27.053 2.77V4.7h-1.86v12.095h5.333V15.15zm7.103-5.908v7.553h-1.843V9.242h1.843z'/%3E %3Cpath fill='%23fff' d='m19.63 11.151-.757-1.71-.345 1.71-1.12 5.644h-1.827L18.083 4.7h.197l3.325 6.533.988 2.19.988-2.19L26.839 4.7h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.93 5.644h-.098l-2.913-5.644zm14.836 5.81q-1.02 0-1.893-.478a3.8 3.8 0 0 1-1.381-1.382q-.51-.906-.51-2.106 0-1.185.444-2.074a3.36 3.36 0 0 1 1.3-1.382q.839-.494 1.974-.494a3.3 3.3 0 0 1 1.234.231 3.3 3.3 0 0 1 .97.575q.396.33.527.659l.033-1.267h1.694v7.553H37.18l-.033-1.332q-.279.593-1.02 1.053a3.17 3.17 0 0 1-1.662.444zm.296-1.482q.938 0 1.58-.642.642-.66.642-1.711v-.115q0-.708-.296-1.267a2.2 2.2 0 0 0-.807-.872 2.1 2.1 0 0 0-1.119-.313q-1.053 0-1.629.692-.575.675-.575 1.76 0 1.103.559 1.795.577.675 1.645.675zm6.521-6.237h1.711v1.4q.906-1.597 2.83-1.597 1.596 0 2.584 1.02.988 1.005.988 2.914 0 1.185-.493 2.09a3.46 3.46 0 0 1-1.316 1.399 3.5 3.5 0 0 1-1.844.493q-.954 0-1.662-.329a2.67 2.67 0 0 1-1.086-.97l.017 5.134h-1.728zm4.048 6.22q1.07 0 1.645-.674.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.592 0-1.12.296-.51.28-.822.823-.296.527-.296 1.234v.115q0 .708.296 1.267.313.543.823.855.51.296 1.119.297z'/%3E %3Cpath fill='%23e1e3e9' d='M51.325 4.7h1.86v10.45h3.473v1.646h-5.333zm7.12 4.542h1.843v7.553h-1.843zm.905-1.415a1.16 1.16 0 0 1-.856-.346 1.17 1.17 0 0 1-.346-.856 1.05 1.05 0 0 1 .346-.79q.346-.329.856-.329.494 0 .839.33a1.05 1.05 0 0 1 .345.79 1.16 1.16 0 0 1-.345.855q-.33.346-.84.346zm7.875 9.133a3.17 3.17 0 0 1-1.662-.444q-.723-.46-1.004-1.053l-.033 1.332h-1.71V4.701h1.743v4.657l-.082 1.283q.279-.658 1.086-1.119a3.5 3.5 0 0 1 1.778-.477q1.119 0 1.942.51a3.24 3.24 0 0 1 1.283 1.4q.445.888.444 2.072 0 1.201-.526 2.09a3.5 3.5 0 0 1-1.382 1.366 3.8 3.8 0 0 1-1.876.477zm-.296-1.481q1.069 0 1.645-.675.577-.69.577-1.778 0-1.102-.577-1.776-.56-.691-1.645-.692a2.12 2.12 0 0 0-1.58.659q-.642.641-.642 1.694v.115q0 .71.296 1.267a2.4 2.4 0 0 0 .807.872 2.1 2.1 0 0 0 1.119.313zm5.927-6.237h1.777v1.481q.263-.757.856-1.217a2.14 2.14 0 0 1 1.349-.46q.527 0 .724.098l-.247 1.794q-.149-.099-.642-.099-.774 0-1.416.494-.626.493-.626 1.58v3.883h-1.777V9.242zm9.534 7.718q-1.35 0-2.255-.526-.904-.543-1.332-1.432a4.6 4.6 0 0 1-.428-1.975q0-1.2.493-2.106a3.46 3.46 0 0 1 1.4-1.382q.889-.495 2.007-.494 1.744 0 2.584.97.855.956.856 2.7 0 .444-.05.92h-5.43q.18 1.005.708 1.45.542.443 1.497.443.79 0 1.3-.131a4 4 0 0 0 .938-.362l.542 1.267q-.411.263-1.119.46-.708.198-1.711.197zm1.596-4.558q.016-1.02-.444-1.432-.46-.428-1.316-.428-1.728 0-1.991 1.86z'/%3E %3Cpath d='M5.074 15.948a.484.657 0 0 0-.486.659v1.84a.484.657 0 0 0 .486.659h4.101a.484.657 0 0 0 .486-.659v-1.84a.484.657 0 0 0-.486-.659zm3.56 1.16H5.617v.838h3.017z' style='fill:%23fff;fill-rule:evenodd;stroke-width:1.03600001'/%3E %3Cg style='stroke-width:1.12603545'%3E %3Cpath d='M-9.408-1.416c-3.833-.025-7.056 2.912-7.08 6.615-.02 3.08 1.653 4.832 3.107 6.268.903.892 1.721 1.74 2.32 2.902l-.525-.004c-.543-.003-.992.304-1.24.639a1.87 1.87 0 0 0-.362 1.121l-.011 1.877c-.003.402.104.787.347 1.125.244.338.688.653 1.23.656l4.142.028c.542.003.99-.306 1.238-.641a1.87 1.87 0 0 0 .363-1.121l.012-1.875a1.87 1.87 0 0 0-.348-1.127c-.243-.338-.688-.653-1.23-.656l-.518-.004c.597-1.145 1.425-1.983 2.348-2.87 1.473-1.414 3.18-3.149 3.2-6.226-.016-3.59-2.923-6.684-6.993-6.707m-.006 1.1v.002c3.274.02 5.92 2.532 5.9 5.6-.017 2.706-1.39 4.026-2.863 5.44-1.034.994-2.118 2.033-2.814 3.633-.018.041-.052.055-.075.065q-.013.004-.02.01a.34.34 0 0 1-.226.084.34.34 0 0 1-.224-.086l-.092-.077c-.699-1.615-1.768-2.669-2.781-3.67-1.454-1.435-2.797-2.762-2.78-5.478.02-3.067 2.7-5.545 5.975-5.523m-.02 2.826c-1.62-.01-2.944 1.315-2.955 2.96-.01 1.646 1.295 2.988 2.916 2.999h.002c1.621.01 2.943-1.316 2.953-2.961.011-1.646-1.294-2.988-2.916-2.998m-.005 1.1c1.017.006 1.829.83 1.822 1.89s-.83 1.874-1.848 1.867c-1.018-.006-1.829-.83-1.822-1.89s.83-1.874 1.848-1.868m-2.155 11.857 4.14.025c.271.002.49.305.487.676l-.013 1.875c-.003.37-.224.67-.495.668l-4.14-.025c-.27-.002-.487-.306-.485-.676l.012-1.875c.003-.37.224-.67.494-.668' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;font-variant-ligatures:normal;font-variant-position:normal;font-variant-caps:normal;font-variant-numeric:normal;font-variant-alternates:normal;font-feature-settings:normal;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;writing-mode:lr-tb;direction:ltr;text-orientation:mixed;dominant-baseline:auto;baseline-shift:baseline;text-anchor:start;white-space:normal;shape-padding:0;clip-rule:evenodd;display:inline;overflow:visible;visibility:visible;opacity:1;isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:1;vector-effect:none;fill:%23000;fill-opacity:.4;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-9.415-.316C-12.69-.338-15.37 2.14-15.39 5.207c-.017 2.716 1.326 4.041 2.78 5.477 1.013 1 2.081 2.055 2.78 3.67l.092.076a.34.34 0 0 0 .225.086.34.34 0 0 0 .227-.083l.019-.01c.022-.009.057-.024.074-.064.697-1.6 1.78-2.64 2.814-3.634 1.473-1.414 2.847-2.733 2.864-5.44.02-3.067-2.627-5.58-5.901-5.601m-.057 8.784c1.621.011 2.944-1.315 2.955-2.96.01-1.646-1.295-2.988-2.916-2.999-1.622-.01-2.945 1.315-2.955 2.96s1.295 2.989 2.916 3' style='clip-rule:evenodd;fill:%23e1e3e9;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-11.594 15.465c-.27-.002-.492.297-.494.668l-.012 1.876c-.003.371.214.673.485.675l4.14.027c.271.002.492-.298.495-.668l.012-1.877c.003-.37-.215-.672-.485-.674z' style='clip-rule:evenodd;fill:%23fff;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3C/g%3E %3C/svg%3E")}a.maplibregl-ctrl-logo.maplibregl-compact{width:14px}@media(forced-colors:active){a.maplibregl-ctrl-logo{background-color:transparent;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='23' fill='none'%3E %3Cpath fill='%23000' fill-opacity='.4' fill-rule='evenodd' d='M17.408 16.796h-1.827l2.501-12.095h.198l3.324 6.533.988 2.19.988-2.19 3.258-6.533h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.929 5.644h-.098l-2.914-5.644-.757-1.71-.345 1.71zm1.958-3.42-.726 3.663a1.255 1.255 0 0 1-1.232 1.011h-1.827a1.255 1.255 0 0 1-1.229-1.509l2.501-12.095a1.255 1.255 0 0 1 1.23-1.001h.197a1.25 1.25 0 0 1 1.12.685l3.19 6.273 3.125-6.263a1.25 1.25 0 0 1 1.123-.695h.181a1.255 1.255 0 0 1 1.227.991l1.443 6.71a5 5 0 0 1 .314-.787l.009-.016a4.6 4.6 0 0 1 1.777-1.887c.782-.46 1.668-.667 2.611-.667a4.6 4.6 0 0 1 1.7.32l.306.134c.21-.16.474-.256.759-.256h1.694a1.255 1.255 0 0 1 1.212.925 1.255 1.255 0 0 1 1.212-.925h1.711c.284 0 .545.094.755.252.613-.3 1.312-.45 2.075-.45 1.356 0 2.557.445 3.482 1.4q.47.48.763 1.064V4.701a1.255 1.255 0 0 1 1.255-1.255h1.86A1.255 1.255 0 0 1 54.44 4.7v9.194h2.217c.19 0 .37.043.532.118v-4.77c0-.356.147-.678.385-.906a2.42 2.42 0 0 1-.682-1.71c0-.665.267-1.253.735-1.7a2.45 2.45 0 0 1 1.722-.674 2.43 2.43 0 0 1 1.705.675q.318.302.504.683V4.7a1.255 1.255 0 0 1 1.255-1.255h1.744A1.255 1.255 0 0 1 65.812 4.7v3.335a4.8 4.8 0 0 1 1.526-.246c.938 0 1.817.214 2.59.69a4.47 4.47 0 0 1 1.67 1.743v-.98a1.255 1.255 0 0 1 1.256-1.256h1.777c.233 0 .451.064.639.174a3.4 3.4 0 0 1 1.567-.372c.346 0 .861.02 1.285.232a1.25 1.25 0 0 1 .689 1.004 4.7 4.7 0 0 1 .853-.588c.795-.44 1.675-.647 2.61-.647 1.385 0 2.65.39 3.525 1.396.836.938 1.168 2.173 1.168 3.528q-.001.515-.056 1.051a1.255 1.255 0 0 1-.947 1.09l.408.952a1.255 1.255 0 0 1-.477 1.552c-.418.268-.92.463-1.458.612-.613.171-1.304.244-2.049.244-1.06 0-2.043-.207-2.886-.698l-.015-.008c-.798-.48-1.419-1.135-1.818-1.963l-.004-.008a5.8 5.8 0 0 1-.548-2.512q0-.429.053-.843a1.3 1.3 0 0 1-.333-.086l-.166-.004c-.223 0-.426.062-.643.228-.03.024-.142.139-.142.59v3.883a1.255 1.255 0 0 1-1.256 1.256h-1.777a1.255 1.255 0 0 1-1.256-1.256V15.69l-.032.057a4.8 4.8 0 0 1-1.86 1.833 5.04 5.04 0 0 1-2.484.634 4.5 4.5 0 0 1-1.935-.424 1.25 1.25 0 0 1-.764.258h-1.71a1.255 1.255 0 0 1-1.256-1.255V7.687a2.4 2.4 0 0 1-.428.625c.253.23.412.561.412.93v7.553a1.255 1.255 0 0 1-1.256 1.255h-1.843a1.25 1.25 0 0 1-.894-.373c-.228.23-.544.373-.894.373H51.32a1.255 1.255 0 0 1-1.256-1.255v-1.251l-.061.117a4.7 4.7 0 0 1-1.782 1.884 4.77 4.77 0 0 1-2.485.67 5.6 5.6 0 0 1-1.485-.188l.009 2.764a1.255 1.255 0 0 1-1.255 1.259h-1.729a1.255 1.255 0 0 1-1.255-1.255v-3.537a1.255 1.255 0 0 1-1.167.793h-1.679a1.25 1.25 0 0 1-.77-.263 4.5 4.5 0 0 1-1.945.429c-.885 0-1.724-.21-2.495-.632l-.017-.01a5 5 0 0 1-1.081-.836 1.255 1.255 0 0 1-1.254 1.312h-1.81a1.255 1.255 0 0 1-1.228-.99l-.782-3.625-2.044 3.939a1.25 1.25 0 0 1-1.115.676h-.098a1.25 1.25 0 0 1-1.116-.68l-2.061-3.994zM35.92 16.63l.207-.114.223-.15q.493-.356.735-.785l.061-.118.033 1.332h1.678V9.242h-1.694l-.033 1.267q-.133-.329-.526-.658l-.032-.028a3.2 3.2 0 0 0-.668-.428l-.27-.12a3.3 3.3 0 0 0-1.235-.23q-1.136-.001-1.974.493a3.36 3.36 0 0 0-1.3 1.382q-.445.89-.444 2.074 0 1.2.51 2.107a3.8 3.8 0 0 0 1.382 1.381 3.9 3.9 0 0 0 1.893.477q.795 0 1.455-.33zm-2.789-5.38q-.576.675-.575 1.762 0 1.102.559 1.794.576.675 1.645.675a2.25 2.25 0 0 0 .934-.19 2.2 2.2 0 0 0 .468-.29l.178-.161a2.2 2.2 0 0 0 .397-.561q.244-.5.244-1.15v-.115q0-.708-.296-1.267l-.043-.077a2.2 2.2 0 0 0-.633-.709l-.13-.086-.047-.028a2.1 2.1 0 0 0-1.073-.285q-1.052 0-1.629.692zm2.316 2.706c.163-.17.28-.407.28-.83v-.114c0-.292-.06-.508-.15-.68a.96.96 0 0 0-.353-.389.85.85 0 0 0-.464-.127c-.4 0-.56.114-.664.239l-.01.012c-.148.174-.275.45-.275.945 0 .506.122.801.27.99.097.11.266.224.68.224.303 0 .504-.09.687-.269zm7.545 1.705a2.6 2.6 0 0 0 .331.423q.319.33.755.548l.173.074q.65.255 1.49.255 1.02 0 1.844-.493a3.45 3.45 0 0 0 1.316-1.4q.493-.904.493-2.089 0-1.909-.988-2.913-.988-1.02-2.584-1.02-.898 0-1.575.347a3 3 0 0 0-.415.262l-.199.166a3.4 3.4 0 0 0-.64.82V9.242h-1.712v11.553h1.729l-.017-5.134zm.53-1.138q.206.29.48.5l.155.11.053.034q.51.296 1.119.297 1.07 0 1.645-.675.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.435 0-.835.16a2 2 0 0 0-.284.136 2 2 0 0 0-.363.254 2.2 2.2 0 0 0-.46.569l-.082.162a2.6 2.6 0 0 0-.213 1.072v.115q0 .707.296 1.267l.135.211zm.964-.818a1.1 1.1 0 0 0 .367.385.94.94 0 0 0 .476.118c.423 0 .59-.117.687-.23.159-.194.28-.478.28-.95 0-.53-.133-.8-.266-.952l-.021-.025c-.078-.094-.231-.221-.68-.221a1 1 0 0 0-.503.135l-.012.007a.86.86 0 0 0-.335.343c-.073.133-.132.324-.132.614v.115a1.4 1.4 0 0 0 .14.66zm15.7-6.222q.347-.346.346-.856a1.05 1.05 0 0 0-.345-.79 1.18 1.18 0 0 0-.84-.329q-.51 0-.855.33a1.05 1.05 0 0 0-.346.79q0 .51.346.855.345.346.856.346.51 0 .839-.346zm4.337 9.314.033-1.332q.191.403.59.747l.098.081a4 4 0 0 0 .316.224l.223.122a3.2 3.2 0 0 0 1.44.322 3.8 3.8 0 0 0 1.875-.477 3.5 3.5 0 0 0 1.382-1.366q.527-.89.526-2.09 0-1.184-.444-2.073a3.24 3.24 0 0 0-1.283-1.399q-.823-.51-1.942-.51a3.5 3.5 0 0 0-1.527.344l-.086.043-.165.09a3 3 0 0 0-.33.214q-.432.315-.656.707a2 2 0 0 0-.099.198l.082-1.283V4.701h-1.744v12.095zm.473-2.509a2.5 2.5 0 0 0 .566.7q.117.098.245.18l.144.08a2.1 2.1 0 0 0 .975.232q1.07 0 1.645-.675.576-.69.576-1.778 0-1.102-.576-1.777-.56-.691-1.645-.692a2.2 2.2 0 0 0-1.015.235q-.22.113-.415.282l-.15.142a2.1 2.1 0 0 0-.42.594q-.223.479-.223 1.1v.115q0 .705.293 1.26zm2.616-.293c.157-.191.28-.479.28-.967 0-.51-.13-.79-.276-.961l-.021-.026c-.082-.1-.232-.225-.67-.225a.87.87 0 0 0-.681.279l-.012.011c-.154.155-.274.38-.274.807v.115c0 .285.057.499.144.669a1.1 1.1 0 0 0 .367.405c.137.082.28.123.455.123.423 0 .59-.118.686-.23zm8.266-3.013q.345-.13.724-.14l.069-.002q.493 0 .642.099l.247-1.794q-.196-.099-.717-.099a2.3 2.3 0 0 0-.545.063 2 2 0 0 0-.411.148 2.2 2.2 0 0 0-.4.249 2.5 2.5 0 0 0-.485.499 2.7 2.7 0 0 0-.32.581l-.05.137v-1.48h-1.778v7.553h1.777v-3.884q0-.546.159-.943a1.5 1.5 0 0 1 .466-.636 2.5 2.5 0 0 1 .399-.253 2 2 0 0 1 .224-.099zm9.784 2.656.05-.922q0-1.743-.856-2.698-.838-.97-2.584-.97-1.119-.001-2.007.493a3.46 3.46 0 0 0-1.4 1.382q-.493.906-.493 2.106 0 1.07.428 1.975.428.89 1.332 1.432.906.526 2.255.526.973 0 1.668-.185l.044-.012.135-.04q.613-.184.984-.421l-.542-1.267q-.3.162-.642.274l-.297.087q-.51.131-1.3.131-.954 0-1.497-.444a1.6 1.6 0 0 1-.192-.193q-.366-.44-.512-1.234l-.004-.021zm-5.427-1.256-.003.022h3.752v-.138q-.011-.727-.288-1.118a1 1 0 0 0-.156-.176q-.46-.428-1.316-.428-.986 0-1.494.604-.379.45-.494 1.234zm-27.053 2.77V4.7h-1.86v12.095h5.333V15.15zm7.103-5.908v7.553h-1.843V9.242h1.843z'/%3E %3Cpath fill='%23fff' d='m19.63 11.151-.757-1.71-.345 1.71-1.12 5.644h-1.827L18.083 4.7h.197l3.325 6.533.988 2.19.988-2.19L26.839 4.7h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.93 5.644h-.098l-2.913-5.644zm14.836 5.81q-1.02 0-1.893-.478a3.8 3.8 0 0 1-1.381-1.382q-.51-.906-.51-2.106 0-1.185.444-2.074a3.36 3.36 0 0 1 1.3-1.382q.839-.494 1.974-.494a3.3 3.3 0 0 1 1.234.231 3.3 3.3 0 0 1 .97.575q.396.33.527.659l.033-1.267h1.694v7.553H37.18l-.033-1.332q-.279.593-1.02 1.053a3.17 3.17 0 0 1-1.662.444zm.296-1.482q.938 0 1.58-.642.642-.66.642-1.711v-.115q0-.708-.296-1.267a2.2 2.2 0 0 0-.807-.872 2.1 2.1 0 0 0-1.119-.313q-1.053 0-1.629.692-.575.675-.575 1.76 0 1.103.559 1.795.577.675 1.645.675zm6.521-6.237h1.711v1.4q.906-1.597 2.83-1.597 1.596 0 2.584 1.02.988 1.005.988 2.914 0 1.185-.493 2.09a3.46 3.46 0 0 1-1.316 1.399 3.5 3.5 0 0 1-1.844.493q-.954 0-1.662-.329a2.67 2.67 0 0 1-1.086-.97l.017 5.134h-1.728zm4.048 6.22q1.07 0 1.645-.674.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.592 0-1.12.296-.51.28-.822.823-.296.527-.296 1.234v.115q0 .708.296 1.267.313.543.823.855.51.296 1.119.297z'/%3E %3Cpath fill='%23e1e3e9' d='M51.325 4.7h1.86v10.45h3.473v1.646h-5.333zm7.12 4.542h1.843v7.553h-1.843zm.905-1.415a1.16 1.16 0 0 1-.856-.346 1.17 1.17 0 0 1-.346-.856 1.05 1.05 0 0 1 .346-.79q.346-.329.856-.329.494 0 .839.33a1.05 1.05 0 0 1 .345.79 1.16 1.16 0 0 1-.345.855q-.33.346-.84.346zm7.875 9.133a3.17 3.17 0 0 1-1.662-.444q-.723-.46-1.004-1.053l-.033 1.332h-1.71V4.701h1.743v4.657l-.082 1.283q.279-.658 1.086-1.119a3.5 3.5 0 0 1 1.778-.477q1.119 0 1.942.51a3.24 3.24 0 0 1 1.283 1.4q.445.888.444 2.072 0 1.201-.526 2.09a3.5 3.5 0 0 1-1.382 1.366 3.8 3.8 0 0 1-1.876.477zm-.296-1.481q1.069 0 1.645-.675.577-.69.577-1.778 0-1.102-.577-1.776-.56-.691-1.645-.692a2.12 2.12 0 0 0-1.58.659q-.642.641-.642 1.694v.115q0 .71.296 1.267a2.4 2.4 0 0 0 .807.872 2.1 2.1 0 0 0 1.119.313zm5.927-6.237h1.777v1.481q.263-.757.856-1.217a2.14 2.14 0 0 1 1.349-.46q.527 0 .724.098l-.247 1.794q-.149-.099-.642-.099-.774 0-1.416.494-.626.493-.626 1.58v3.883h-1.777V9.242zm9.534 7.718q-1.35 0-2.255-.526-.904-.543-1.332-1.432a4.6 4.6 0 0 1-.428-1.975q0-1.2.493-2.106a3.46 3.46 0 0 1 1.4-1.382q.889-.495 2.007-.494 1.744 0 2.584.97.855.956.856 2.7 0 .444-.05.92h-5.43q.18 1.005.708 1.45.542.443 1.497.443.79 0 1.3-.131a4 4 0 0 0 .938-.362l.542 1.267q-.411.263-1.119.46-.708.198-1.711.197zm1.596-4.558q.016-1.02-.444-1.432-.46-.428-1.316-.428-1.728 0-1.991 1.86z'/%3E %3Cpath d='M5.074 15.948a.484.657 0 0 0-.486.659v1.84a.484.657 0 0 0 .486.659h4.101a.484.657 0 0 0 .486-.659v-1.84a.484.657 0 0 0-.486-.659zm3.56 1.16H5.617v.838h3.017z' style='fill:%23fff;fill-rule:evenodd;stroke-width:1.03600001'/%3E %3Cg style='stroke-width:1.12603545'%3E %3Cpath d='M-9.408-1.416c-3.833-.025-7.056 2.912-7.08 6.615-.02 3.08 1.653 4.832 3.107 6.268.903.892 1.721 1.74 2.32 2.902l-.525-.004c-.543-.003-.992.304-1.24.639a1.87 1.87 0 0 0-.362 1.121l-.011 1.877c-.003.402.104.787.347 1.125.244.338.688.653 1.23.656l4.142.028c.542.003.99-.306 1.238-.641a1.87 1.87 0 0 0 .363-1.121l.012-1.875a1.87 1.87 0 0 0-.348-1.127c-.243-.338-.688-.653-1.23-.656l-.518-.004c.597-1.145 1.425-1.983 2.348-2.87 1.473-1.414 3.18-3.149 3.2-6.226-.016-3.59-2.923-6.684-6.993-6.707m-.006 1.1v.002c3.274.02 5.92 2.532 5.9 5.6-.017 2.706-1.39 4.026-2.863 5.44-1.034.994-2.118 2.033-2.814 3.633-.018.041-.052.055-.075.065q-.013.004-.02.01a.34.34 0 0 1-.226.084.34.34 0 0 1-.224-.086l-.092-.077c-.699-1.615-1.768-2.669-2.781-3.67-1.454-1.435-2.797-2.762-2.78-5.478.02-3.067 2.7-5.545 5.975-5.523m-.02 2.826c-1.62-.01-2.944 1.315-2.955 2.96-.01 1.646 1.295 2.988 2.916 2.999h.002c1.621.01 2.943-1.316 2.953-2.961.011-1.646-1.294-2.988-2.916-2.998m-.005 1.1c1.017.006 1.829.83 1.822 1.89s-.83 1.874-1.848 1.867c-1.018-.006-1.829-.83-1.822-1.89s.83-1.874 1.848-1.868m-2.155 11.857 4.14.025c.271.002.49.305.487.676l-.013 1.875c-.003.37-.224.67-.495.668l-4.14-.025c-.27-.002-.487-.306-.485-.676l.012-1.875c.003-.37.224-.67.494-.668' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;font-variant-ligatures:normal;font-variant-position:normal;font-variant-caps:normal;font-variant-numeric:normal;font-variant-alternates:normal;font-feature-settings:normal;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;writing-mode:lr-tb;direction:ltr;text-orientation:mixed;dominant-baseline:auto;baseline-shift:baseline;text-anchor:start;white-space:normal;shape-padding:0;clip-rule:evenodd;display:inline;overflow:visible;visibility:visible;opacity:1;isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:1;vector-effect:none;fill:%23000;fill-opacity:.4;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-9.415-.316C-12.69-.338-15.37 2.14-15.39 5.207c-.017 2.716 1.326 4.041 2.78 5.477 1.013 1 2.081 2.055 2.78 3.67l.092.076a.34.34 0 0 0 .225.086.34.34 0 0 0 .227-.083l.019-.01c.022-.009.057-.024.074-.064.697-1.6 1.78-2.64 2.814-3.634 1.473-1.414 2.847-2.733 2.864-5.44.02-3.067-2.627-5.58-5.901-5.601m-.057 8.784c1.621.011 2.944-1.315 2.955-2.96.01-1.646-1.295-2.988-2.916-2.999-1.622-.01-2.945 1.315-2.955 2.96s1.295 2.989 2.916 3' style='clip-rule:evenodd;fill:%23e1e3e9;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-11.594 15.465c-.27-.002-.492.297-.494.668l-.012 1.876c-.003.371.214.673.485.675l4.14.027c.271.002.492-.298.495-.668l.012-1.877c.003-.37-.215-.672-.485-.674z' style='clip-rule:evenodd;fill:%23fff;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3C/g%3E %3C/svg%3E")}}@media(forced-colors:active)and (prefers-color-scheme:light){a.maplibregl-ctrl-logo{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='23' fill='none'%3E %3Cpath fill='%23000' fill-opacity='.4' fill-rule='evenodd' d='M17.408 16.796h-1.827l2.501-12.095h.198l3.324 6.533.988 2.19.988-2.19 3.258-6.533h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.929 5.644h-.098l-2.914-5.644-.757-1.71-.345 1.71zm1.958-3.42-.726 3.663a1.255 1.255 0 0 1-1.232 1.011h-1.827a1.255 1.255 0 0 1-1.229-1.509l2.501-12.095a1.255 1.255 0 0 1 1.23-1.001h.197a1.25 1.25 0 0 1 1.12.685l3.19 6.273 3.125-6.263a1.25 1.25 0 0 1 1.123-.695h.181a1.255 1.255 0 0 1 1.227.991l1.443 6.71a5 5 0 0 1 .314-.787l.009-.016a4.6 4.6 0 0 1 1.777-1.887c.782-.46 1.668-.667 2.611-.667a4.6 4.6 0 0 1 1.7.32l.306.134c.21-.16.474-.256.759-.256h1.694a1.255 1.255 0 0 1 1.212.925 1.255 1.255 0 0 1 1.212-.925h1.711c.284 0 .545.094.755.252.613-.3 1.312-.45 2.075-.45 1.356 0 2.557.445 3.482 1.4q.47.48.763 1.064V4.701a1.255 1.255 0 0 1 1.255-1.255h1.86A1.255 1.255 0 0 1 54.44 4.7v9.194h2.217c.19 0 .37.043.532.118v-4.77c0-.356.147-.678.385-.906a2.42 2.42 0 0 1-.682-1.71c0-.665.267-1.253.735-1.7a2.45 2.45 0 0 1 1.722-.674 2.43 2.43 0 0 1 1.705.675q.318.302.504.683V4.7a1.255 1.255 0 0 1 1.255-1.255h1.744A1.255 1.255 0 0 1 65.812 4.7v3.335a4.8 4.8 0 0 1 1.526-.246c.938 0 1.817.214 2.59.69a4.47 4.47 0 0 1 1.67 1.743v-.98a1.255 1.255 0 0 1 1.256-1.256h1.777c.233 0 .451.064.639.174a3.4 3.4 0 0 1 1.567-.372c.346 0 .861.02 1.285.232a1.25 1.25 0 0 1 .689 1.004 4.7 4.7 0 0 1 .853-.588c.795-.44 1.675-.647 2.61-.647 1.385 0 2.65.39 3.525 1.396.836.938 1.168 2.173 1.168 3.528q-.001.515-.056 1.051a1.255 1.255 0 0 1-.947 1.09l.408.952a1.255 1.255 0 0 1-.477 1.552c-.418.268-.92.463-1.458.612-.613.171-1.304.244-2.049.244-1.06 0-2.043-.207-2.886-.698l-.015-.008c-.798-.48-1.419-1.135-1.818-1.963l-.004-.008a5.8 5.8 0 0 1-.548-2.512q0-.429.053-.843a1.3 1.3 0 0 1-.333-.086l-.166-.004c-.223 0-.426.062-.643.228-.03.024-.142.139-.142.59v3.883a1.255 1.255 0 0 1-1.256 1.256h-1.777a1.255 1.255 0 0 1-1.256-1.256V15.69l-.032.057a4.8 4.8 0 0 1-1.86 1.833 5.04 5.04 0 0 1-2.484.634 4.5 4.5 0 0 1-1.935-.424 1.25 1.25 0 0 1-.764.258h-1.71a1.255 1.255 0 0 1-1.256-1.255V7.687a2.4 2.4 0 0 1-.428.625c.253.23.412.561.412.93v7.553a1.255 1.255 0 0 1-1.256 1.255h-1.843a1.25 1.25 0 0 1-.894-.373c-.228.23-.544.373-.894.373H51.32a1.255 1.255 0 0 1-1.256-1.255v-1.251l-.061.117a4.7 4.7 0 0 1-1.782 1.884 4.77 4.77 0 0 1-2.485.67 5.6 5.6 0 0 1-1.485-.188l.009 2.764a1.255 1.255 0 0 1-1.255 1.259h-1.729a1.255 1.255 0 0 1-1.255-1.255v-3.537a1.255 1.255 0 0 1-1.167.793h-1.679a1.25 1.25 0 0 1-.77-.263 4.5 4.5 0 0 1-1.945.429c-.885 0-1.724-.21-2.495-.632l-.017-.01a5 5 0 0 1-1.081-.836 1.255 1.255 0 0 1-1.254 1.312h-1.81a1.255 1.255 0 0 1-1.228-.99l-.782-3.625-2.044 3.939a1.25 1.25 0 0 1-1.115.676h-.098a1.25 1.25 0 0 1-1.116-.68l-2.061-3.994zM35.92 16.63l.207-.114.223-.15q.493-.356.735-.785l.061-.118.033 1.332h1.678V9.242h-1.694l-.033 1.267q-.133-.329-.526-.658l-.032-.028a3.2 3.2 0 0 0-.668-.428l-.27-.12a3.3 3.3 0 0 0-1.235-.23q-1.136-.001-1.974.493a3.36 3.36 0 0 0-1.3 1.382q-.445.89-.444 2.074 0 1.2.51 2.107a3.8 3.8 0 0 0 1.382 1.381 3.9 3.9 0 0 0 1.893.477q.795 0 1.455-.33zm-2.789-5.38q-.576.675-.575 1.762 0 1.102.559 1.794.576.675 1.645.675a2.25 2.25 0 0 0 .934-.19 2.2 2.2 0 0 0 .468-.29l.178-.161a2.2 2.2 0 0 0 .397-.561q.244-.5.244-1.15v-.115q0-.708-.296-1.267l-.043-.077a2.2 2.2 0 0 0-.633-.709l-.13-.086-.047-.028a2.1 2.1 0 0 0-1.073-.285q-1.052 0-1.629.692zm2.316 2.706c.163-.17.28-.407.28-.83v-.114c0-.292-.06-.508-.15-.68a.96.96 0 0 0-.353-.389.85.85 0 0 0-.464-.127c-.4 0-.56.114-.664.239l-.01.012c-.148.174-.275.45-.275.945 0 .506.122.801.27.99.097.11.266.224.68.224.303 0 .504-.09.687-.269zm7.545 1.705a2.6 2.6 0 0 0 .331.423q.319.33.755.548l.173.074q.65.255 1.49.255 1.02 0 1.844-.493a3.45 3.45 0 0 0 1.316-1.4q.493-.904.493-2.089 0-1.909-.988-2.913-.988-1.02-2.584-1.02-.898 0-1.575.347a3 3 0 0 0-.415.262l-.199.166a3.4 3.4 0 0 0-.64.82V9.242h-1.712v11.553h1.729l-.017-5.134zm.53-1.138q.206.29.48.5l.155.11.053.034q.51.296 1.119.297 1.07 0 1.645-.675.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.435 0-.835.16a2 2 0 0 0-.284.136 2 2 0 0 0-.363.254 2.2 2.2 0 0 0-.46.569l-.082.162a2.6 2.6 0 0 0-.213 1.072v.115q0 .707.296 1.267l.135.211zm.964-.818a1.1 1.1 0 0 0 .367.385.94.94 0 0 0 .476.118c.423 0 .59-.117.687-.23.159-.194.28-.478.28-.95 0-.53-.133-.8-.266-.952l-.021-.025c-.078-.094-.231-.221-.68-.221a1 1 0 0 0-.503.135l-.012.007a.86.86 0 0 0-.335.343c-.073.133-.132.324-.132.614v.115a1.4 1.4 0 0 0 .14.66zm15.7-6.222q.347-.346.346-.856a1.05 1.05 0 0 0-.345-.79 1.18 1.18 0 0 0-.84-.329q-.51 0-.855.33a1.05 1.05 0 0 0-.346.79q0 .51.346.855.345.346.856.346.51 0 .839-.346zm4.337 9.314.033-1.332q.191.403.59.747l.098.081a4 4 0 0 0 .316.224l.223.122a3.2 3.2 0 0 0 1.44.322 3.8 3.8 0 0 0 1.875-.477 3.5 3.5 0 0 0 1.382-1.366q.527-.89.526-2.09 0-1.184-.444-2.073a3.24 3.24 0 0 0-1.283-1.399q-.823-.51-1.942-.51a3.5 3.5 0 0 0-1.527.344l-.086.043-.165.09a3 3 0 0 0-.33.214q-.432.315-.656.707a2 2 0 0 0-.099.198l.082-1.283V4.701h-1.744v12.095zm.473-2.509a2.5 2.5 0 0 0 .566.7q.117.098.245.18l.144.08a2.1 2.1 0 0 0 .975.232q1.07 0 1.645-.675.576-.69.576-1.778 0-1.102-.576-1.777-.56-.691-1.645-.692a2.2 2.2 0 0 0-1.015.235q-.22.113-.415.282l-.15.142a2.1 2.1 0 0 0-.42.594q-.223.479-.223 1.1v.115q0 .705.293 1.26zm2.616-.293c.157-.191.28-.479.28-.967 0-.51-.13-.79-.276-.961l-.021-.026c-.082-.1-.232-.225-.67-.225a.87.87 0 0 0-.681.279l-.012.011c-.154.155-.274.38-.274.807v.115c0 .285.057.499.144.669a1.1 1.1 0 0 0 .367.405c.137.082.28.123.455.123.423 0 .59-.118.686-.23zm8.266-3.013q.345-.13.724-.14l.069-.002q.493 0 .642.099l.247-1.794q-.196-.099-.717-.099a2.3 2.3 0 0 0-.545.063 2 2 0 0 0-.411.148 2.2 2.2 0 0 0-.4.249 2.5 2.5 0 0 0-.485.499 2.7 2.7 0 0 0-.32.581l-.05.137v-1.48h-1.778v7.553h1.777v-3.884q0-.546.159-.943a1.5 1.5 0 0 1 .466-.636 2.5 2.5 0 0 1 .399-.253 2 2 0 0 1 .224-.099zm9.784 2.656.05-.922q0-1.743-.856-2.698-.838-.97-2.584-.97-1.119-.001-2.007.493a3.46 3.46 0 0 0-1.4 1.382q-.493.906-.493 2.106 0 1.07.428 1.975.428.89 1.332 1.432.906.526 2.255.526.973 0 1.668-.185l.044-.012.135-.04q.613-.184.984-.421l-.542-1.267q-.3.162-.642.274l-.297.087q-.51.131-1.3.131-.954 0-1.497-.444a1.6 1.6 0 0 1-.192-.193q-.366-.44-.512-1.234l-.004-.021zm-5.427-1.256-.003.022h3.752v-.138q-.011-.727-.288-1.118a1 1 0 0 0-.156-.176q-.46-.428-1.316-.428-.986 0-1.494.604-.379.45-.494 1.234zm-27.053 2.77V4.7h-1.86v12.095h5.333V15.15zm7.103-5.908v7.553h-1.843V9.242h1.843z'/%3E %3Cpath fill='%23fff' d='m19.63 11.151-.757-1.71-.345 1.71-1.12 5.644h-1.827L18.083 4.7h.197l3.325 6.533.988 2.19.988-2.19L26.839 4.7h.181l2.6 12.095h-1.81l-1.218-5.644-.362-1.71-.658 1.71-2.93 5.644h-.098l-2.913-5.644zm14.836 5.81q-1.02 0-1.893-.478a3.8 3.8 0 0 1-1.381-1.382q-.51-.906-.51-2.106 0-1.185.444-2.074a3.36 3.36 0 0 1 1.3-1.382q.839-.494 1.974-.494a3.3 3.3 0 0 1 1.234.231 3.3 3.3 0 0 1 .97.575q.396.33.527.659l.033-1.267h1.694v7.553H37.18l-.033-1.332q-.279.593-1.02 1.053a3.17 3.17 0 0 1-1.662.444zm.296-1.482q.938 0 1.58-.642.642-.66.642-1.711v-.115q0-.708-.296-1.267a2.2 2.2 0 0 0-.807-.872 2.1 2.1 0 0 0-1.119-.313q-1.053 0-1.629.692-.575.675-.575 1.76 0 1.103.559 1.795.577.675 1.645.675zm6.521-6.237h1.711v1.4q.906-1.597 2.83-1.597 1.596 0 2.584 1.02.988 1.005.988 2.914 0 1.185-.493 2.09a3.46 3.46 0 0 1-1.316 1.399 3.5 3.5 0 0 1-1.844.493q-.954 0-1.662-.329a2.67 2.67 0 0 1-1.086-.97l.017 5.134h-1.728zm4.048 6.22q1.07 0 1.645-.674.577-.69.576-1.762 0-1.119-.576-1.777-.558-.675-1.645-.675-.592 0-1.12.296-.51.28-.822.823-.296.527-.296 1.234v.115q0 .708.296 1.267.313.543.823.855.51.296 1.119.297z'/%3E %3Cpath fill='%23e1e3e9' d='M51.325 4.7h1.86v10.45h3.473v1.646h-5.333zm7.12 4.542h1.843v7.553h-1.843zm.905-1.415a1.16 1.16 0 0 1-.856-.346 1.17 1.17 0 0 1-.346-.856 1.05 1.05 0 0 1 .346-.79q.346-.329.856-.329.494 0 .839.33a1.05 1.05 0 0 1 .345.79 1.16 1.16 0 0 1-.345.855q-.33.346-.84.346zm7.875 9.133a3.17 3.17 0 0 1-1.662-.444q-.723-.46-1.004-1.053l-.033 1.332h-1.71V4.701h1.743v4.657l-.082 1.283q.279-.658 1.086-1.119a3.5 3.5 0 0 1 1.778-.477q1.119 0 1.942.51a3.24 3.24 0 0 1 1.283 1.4q.445.888.444 2.072 0 1.201-.526 2.09a3.5 3.5 0 0 1-1.382 1.366 3.8 3.8 0 0 1-1.876.477zm-.296-1.481q1.069 0 1.645-.675.577-.69.577-1.778 0-1.102-.577-1.776-.56-.691-1.645-.692a2.12 2.12 0 0 0-1.58.659q-.642.641-.642 1.694v.115q0 .71.296 1.267a2.4 2.4 0 0 0 .807.872 2.1 2.1 0 0 0 1.119.313zm5.927-6.237h1.777v1.481q.263-.757.856-1.217a2.14 2.14 0 0 1 1.349-.46q.527 0 .724.098l-.247 1.794q-.149-.099-.642-.099-.774 0-1.416.494-.626.493-.626 1.58v3.883h-1.777V9.242zm9.534 7.718q-1.35 0-2.255-.526-.904-.543-1.332-1.432a4.6 4.6 0 0 1-.428-1.975q0-1.2.493-2.106a3.46 3.46 0 0 1 1.4-1.382q.889-.495 2.007-.494 1.744 0 2.584.97.855.956.856 2.7 0 .444-.05.92h-5.43q.18 1.005.708 1.45.542.443 1.497.443.79 0 1.3-.131a4 4 0 0 0 .938-.362l.542 1.267q-.411.263-1.119.46-.708.198-1.711.197zm1.596-4.558q.016-1.02-.444-1.432-.46-.428-1.316-.428-1.728 0-1.991 1.86z'/%3E %3Cpath d='M5.074 15.948a.484.657 0 0 0-.486.659v1.84a.484.657 0 0 0 .486.659h4.101a.484.657 0 0 0 .486-.659v-1.84a.484.657 0 0 0-.486-.659zm3.56 1.16H5.617v.838h3.017z' style='fill:%23fff;fill-rule:evenodd;stroke-width:1.03600001'/%3E %3Cg style='stroke-width:1.12603545'%3E %3Cpath d='M-9.408-1.416c-3.833-.025-7.056 2.912-7.08 6.615-.02 3.08 1.653 4.832 3.107 6.268.903.892 1.721 1.74 2.32 2.902l-.525-.004c-.543-.003-.992.304-1.24.639a1.87 1.87 0 0 0-.362 1.121l-.011 1.877c-.003.402.104.787.347 1.125.244.338.688.653 1.23.656l4.142.028c.542.003.99-.306 1.238-.641a1.87 1.87 0 0 0 .363-1.121l.012-1.875a1.87 1.87 0 0 0-.348-1.127c-.243-.338-.688-.653-1.23-.656l-.518-.004c.597-1.145 1.425-1.983 2.348-2.87 1.473-1.414 3.18-3.149 3.2-6.226-.016-3.59-2.923-6.684-6.993-6.707m-.006 1.1v.002c3.274.02 5.92 2.532 5.9 5.6-.017 2.706-1.39 4.026-2.863 5.44-1.034.994-2.118 2.033-2.814 3.633-.018.041-.052.055-.075.065q-.013.004-.02.01a.34.34 0 0 1-.226.084.34.34 0 0 1-.224-.086l-.092-.077c-.699-1.615-1.768-2.669-2.781-3.67-1.454-1.435-2.797-2.762-2.78-5.478.02-3.067 2.7-5.545 5.975-5.523m-.02 2.826c-1.62-.01-2.944 1.315-2.955 2.96-.01 1.646 1.295 2.988 2.916 2.999h.002c1.621.01 2.943-1.316 2.953-2.961.011-1.646-1.294-2.988-2.916-2.998m-.005 1.1c1.017.006 1.829.83 1.822 1.89s-.83 1.874-1.848 1.867c-1.018-.006-1.829-.83-1.822-1.89s.83-1.874 1.848-1.868m-2.155 11.857 4.14.025c.271.002.49.305.487.676l-.013 1.875c-.003.37-.224.67-.495.668l-4.14-.025c-.27-.002-.487-.306-.485-.676l.012-1.875c.003-.37.224-.67.494-.668' style='color:%23000;font-style:normal;font-variant:normal;font-weight:400;font-stretch:normal;font-size:medium;line-height:normal;font-family:sans-serif;font-variant-ligatures:normal;font-variant-position:normal;font-variant-caps:normal;font-variant-numeric:normal;font-variant-alternates:normal;font-feature-settings:normal;text-indent:0;text-align:start;text-decoration:none;text-decoration-line:none;text-decoration-style:solid;text-decoration-color:%23000;letter-spacing:normal;word-spacing:normal;text-transform:none;writing-mode:lr-tb;direction:ltr;text-orientation:mixed;dominant-baseline:auto;baseline-shift:baseline;text-anchor:start;white-space:normal;shape-padding:0;clip-rule:evenodd;display:inline;overflow:visible;visibility:visible;opacity:1;isolation:auto;mix-blend-mode:normal;color-interpolation:sRGB;color-interpolation-filters:linearRGB;solid-color:%23000;solid-opacity:1;vector-effect:none;fill:%23000;fill-opacity:.4;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1;color-rendering:auto;image-rendering:auto;shape-rendering:auto;text-rendering:auto' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-9.415-.316C-12.69-.338-15.37 2.14-15.39 5.207c-.017 2.716 1.326 4.041 2.78 5.477 1.013 1 2.081 2.055 2.78 3.67l.092.076a.34.34 0 0 0 .225.086.34.34 0 0 0 .227-.083l.019-.01c.022-.009.057-.024.074-.064.697-1.6 1.78-2.64 2.814-3.634 1.473-1.414 2.847-2.733 2.864-5.44.02-3.067-2.627-5.58-5.901-5.601m-.057 8.784c1.621.011 2.944-1.315 2.955-2.96.01-1.646-1.295-2.988-2.916-2.999-1.622-.01-2.945 1.315-2.955 2.96s1.295 2.989 2.916 3' style='clip-rule:evenodd;fill:%23e1e3e9;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3Cpath d='M-11.594 15.465c-.27-.002-.492.297-.494.668l-.012 1.876c-.003.371.214.673.485.675l4.14.027c.271.002.492-.298.495-.668l.012-1.877c.003-.37-.215-.672-.485-.674z' style='clip-rule:evenodd;fill:%23fff;fill-opacity:1;fill-rule:evenodd;stroke:none;stroke-width:2.47727823;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:.4' transform='translate(15.553 2.85)scale(.88807)'/%3E %3C/g%3E %3C/svg%3E")}}.maplibregl-ctrl.maplibregl-ctrl-attrib{padding:0 5px;background-color:#ffffff80;margin:0}@media screen{.maplibregl-ctrl-attrib.maplibregl-compact{min-height:20px;padding:2px 24px 2px 0;margin:10px;position:relative;background-color:#fff;color:#000;border-radius:12px;box-sizing:content-box}.maplibregl-ctrl-attrib.maplibregl-compact-show{padding:2px 28px 2px 8px;visibility:visible}.maplibregl-ctrl-bottom-left>.maplibregl-ctrl-attrib.maplibregl-compact-show,.maplibregl-ctrl-top-left>.maplibregl-ctrl-attrib.maplibregl-compact-show{padding:2px 8px 2px 28px;border-radius:12px}.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner{display:none}.maplibregl-ctrl-attrib-button{display:none;cursor:pointer;position:absolute;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill-rule='evenodd' viewBox='0 0 20 20'%3E %3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E %3C/svg%3E");background-color:#ffffff80;width:24px;height:24px;box-sizing:border-box;border-radius:12px;outline:none;top:0;right:0;border:0}.maplibregl-ctrl-attrib summary.maplibregl-ctrl-attrib-button{-webkit-appearance:none;-moz-appearance:none;appearance:none;list-style:none}.maplibregl-ctrl-attrib summary.maplibregl-ctrl-attrib-button::-webkit-details-marker{display:none}.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib-button,.maplibregl-ctrl-top-left .maplibregl-ctrl-attrib-button{left:0}.maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button,.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner{display:block}.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button{background-color:#0000000d}.maplibregl-ctrl-bottom-right>.maplibregl-ctrl-attrib.maplibregl-compact:after{bottom:0;right:0}.maplibregl-ctrl-top-right>.maplibregl-ctrl-attrib.maplibregl-compact:after{top:0;right:0}.maplibregl-ctrl-top-left>.maplibregl-ctrl-attrib.maplibregl-compact:after{top:0;left:0}.maplibregl-ctrl-bottom-left>.maplibregl-ctrl-attrib.maplibregl-compact:after{bottom:0;left:0}}@media screen and (forced-colors:active){.maplibregl-ctrl-attrib.maplibregl-compact:after{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill-rule='evenodd' viewBox='0 0 20 20' fill='%23fff'%3E %3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E %3C/svg%3E")}}@media screen and (forced-colors:active)and (prefers-color-scheme:light){.maplibregl-ctrl-attrib.maplibregl-compact:after{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill-rule='evenodd' viewBox='0 0 20 20'%3E %3Cpath d='M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0'/%3E %3C/svg%3E")}}.maplibregl-ctrl-attrib a{color:#000000bf;text-decoration:none}.maplibregl-ctrl-attrib a:hover{color:inherit;text-decoration:underline}.maplibregl-attrib-empty{display:none}.maplibregl-ctrl-scale{background-color:#ffffffbf;font-size:10px;white-space:nowrap;border-color:#333;border-style:none solid solid;border-width:medium 2px 2px;padding:0 5px;color:#333;box-sizing:border-box}.maplibregl-popup{position:absolute;top:0;left:0;display:flex;will-change:transform;pointer-events:none}.maplibregl-popup-anchor-top,.maplibregl-popup-anchor-top-left,.maplibregl-popup-anchor-top-right{flex-direction:column}.maplibregl-popup-anchor-bottom,.maplibregl-popup-anchor-bottom-left,.maplibregl-popup-anchor-bottom-right{flex-direction:column-reverse}.maplibregl-popup-anchor-left{flex-direction:row}.maplibregl-popup-anchor-right,[dir=rtl] .maplibregl-popup-anchor-left{flex-direction:row-reverse}.maplibregl-popup-tip{width:0;height:0;border:10px solid transparent;z-index:1}.maplibregl-popup-anchor-top .maplibregl-popup-tip{align-self:center;border-top:none;border-bottom-color:#fff}.maplibregl-popup-anchor-top-left .maplibregl-popup-tip{align-self:flex-start;border-top:none;border-left:none;border-bottom-color:#fff}.maplibregl-popup-anchor-top-right .maplibregl-popup-tip{align-self:flex-end;border-top:none;border-right:none;border-bottom-color:#fff}.maplibregl-popup-anchor-bottom .maplibregl-popup-tip{align-self:center;border-bottom:none;border-top-color:#fff}.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip{align-self:flex-start;border-bottom:none;border-left:none;border-top-color:#fff}.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip{align-self:flex-end;border-bottom:none;border-right:none;border-top-color:#fff}.maplibregl-popup-anchor-left .maplibregl-popup-tip{align-self:center;border-left:none;border-right-color:#fff}.maplibregl-popup-anchor-right .maplibregl-popup-tip{align-self:center;border-right:none;border-left-color:#fff}[dir=rtl] .maplibregl-popup-anchor-right{flex-direction:row}[dir=rtl] .maplibregl-popup-anchor-top-left .maplibregl-popup-tip{align-self:flex-end}[dir=rtl] .maplibregl-popup-anchor-top-right .maplibregl-popup-tip{align-self:flex-start}[dir=rtl] .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip{align-self:flex-end}[dir=rtl] .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip{align-self:flex-start}.maplibregl-popup-close-button{position:absolute;right:0;top:0;border:0;border-radius:0 3px 0 0;cursor:pointer;background-color:transparent}.maplibregl-popup-close-button:hover{background-color:#0000000d}.maplibregl-popup-content{position:relative;background:#fff;border-radius:3px;box-shadow:0 1px 2px #0000001a;padding:15px 10px;pointer-events:auto}.maplibregl-popup-anchor-top-left .maplibregl-popup-content{border-top-left-radius:0}.maplibregl-popup-anchor-top-right .maplibregl-popup-content{border-top-right-radius:0}.maplibregl-popup-anchor-bottom-left .maplibregl-popup-content{border-bottom-left-radius:0}.maplibregl-popup-anchor-bottom-right .maplibregl-popup-content{border-bottom-right-radius:0}.maplibregl-popup-track-pointer{display:none}.maplibregl-popup-track-pointer *{pointer-events:none;-webkit-user-select:none;-moz-user-select:none;user-select:none}.maplibregl-map:hover .maplibregl-popup-track-pointer{display:flex}.maplibregl-map:active .maplibregl-popup-track-pointer{display:none}.maplibregl-marker{position:absolute;top:0;left:0;will-change:transform;transition:opacity .2s}.maplibregl-marker-draggable{cursor:grab}.maplibregl-user-location-dot,.maplibregl-user-location-dot:before{background-color:#1da1f2;width:15px;height:15px;border-radius:50%}.maplibregl-user-location-dot:before{content:"";position:absolute;animation:maplibregl-user-location-dot-pulse 2s infinite}.maplibregl-user-location-dot:after{border-radius:50%;border:2px solid #fff;content:"";height:19px;left:-2px;position:absolute;top:-2px;width:19px;box-sizing:border-box;box-shadow:0 0 3px #00000059}@media(prefers-reduced-motion:reduce){.maplibregl-user-location-dot:before{animation:none}}@keyframes maplibregl-user-location-dot-pulse{0%{transform:scale(1);opacity:1}70%{transform:scale(3);opacity:0}to{transform:scale(1);opacity:0}}.maplibregl-user-location-dot-stale{background-color:#aaa}.maplibregl-user-location-dot-stale:after{display:none}.maplibregl-user-location-accuracy-circle{background-color:#1da1f233;width:1px;height:1px;border-radius:100%}.maplibregl-crosshair,.maplibregl-crosshair .maplibregl-interactive,.maplibregl-crosshair .maplibregl-interactive:active{cursor:crosshair}.maplibregl-boxzoom{position:absolute;top:0;left:0;width:0;height:0;background:#fff;border:2px dotted #202020;opacity:.5}.maplibregl-cooperative-gesture-screen{background:#0006;position:absolute;top:0;right:0;bottom:0;left:0;display:flex;justify-content:center;align-items:center;color:#fff;padding:1rem;font-size:1.4em;line-height:1.2;opacity:0;pointer-events:none;transition:opacity 1s 1s;z-index:99999}.maplibregl-cooperative-gesture-screen.maplibregl-show{opacity:1;transition:opacity .05s}.maplibregl-cooperative-gesture-screen .maplibregl-mobile-message{display:none}@media(hover:none),(pointer:coarse){.maplibregl-cooperative-gesture-screen .maplibregl-desktop-message{display:none}.maplibregl-cooperative-gesture-screen .maplibregl-mobile-message{display:block}}.maplibregl-pseudo-fullscreen{position:fixed!important;width:100%!important;height:100%!important;top:0!important;left:0!important;z-index:99999}`;
class Fe {
  constructor(t, e, i, r) {
    this.getHass = t, this.onFrameChange = e, this.onLoadProgress = i, this.onPlayStateChange = r, this.blobCache = /* @__PURE__ */ new Map(), this.inFlight = /* @__PURE__ */ new Map(), this.timeline = [], this.satUrlMap = /* @__PURE__ */ new Map(), this.radarUrlMap = /* @__PURE__ */ new Map(), this.currentIndex = 0, this.playing = !1, this.singleLoop = !1, this.speed = 1, this.timerId = null, this.destroyed = !1, this.activeFlags = {
      trueColour: !0,
      cloudOverlay: !0,
      cloudMode: "solar_cloud",
      radar: !0
    };
  }
  get length() {
    return this.timeline.length;
  }
  get index() {
    return this.currentIndex;
  }
  get isPlaying() {
    return this.playing;
  }
  get playbackSpeed() {
    return this.speed;
  }
  setEntryId(t) {
    this.entryId = t;
  }
  withEntryParam(t) {
    if (!this.entryId || !t.startsWith("/api/") || t.includes("entry_id="))
      return t;
    const e = t.includes("?") ? "&" : "?";
    return `${t}${e}entry_id=${encodeURIComponent(this.entryId)}`;
  }
  setLayerFlags(t) {
    const e = this.activeFlags.trueColour !== t.trueColour || this.activeFlags.cloudOverlay !== t.cloudOverlay || this.activeFlags.cloudMode !== t.cloudMode || this.activeFlags.radar !== t.radar;
    if (this.activeFlags = { ...t }, e && this.timeline.length > 0) {
      const i = this.currentIndex;
      this.preloadSlot(i).then(() => {
        !this.destroyed && this.currentIndex === i && this.emitCurrent(), this.preloadAllActive();
      }), this.emitCurrent();
    }
  }
  async loadManifest(t, e = !0) {
    var a;
    const i = this.timeline.length === 0 || this.currentIndex >= this.timeline.length - 1, r = ((a = this.timeline[this.currentIndex]) == null ? void 0 : a.epoch) ?? null;
    this.satUrlMap.clear();
    for (const o of t.providers.satellite.frames)
      this.satUrlMap.set(o.key, {
        true_colour: this.withEntryParam(o.true_colour_url),
        cloud_mask: this.withEntryParam(o.cloud_mask_url),
        solar_cloud: this.withEntryParam(o.solar_cloud_url)
      });
    this.radarUrlMap.clear();
    for (const o of t.providers.radar.frames)
      this.radarUrlMap.set(o.key, this.withEntryParam(o.url));
    if (this.timeline = t.timeline ?? [], this.pruneEvictedBlobs(), this.timeline.length === 0) {
      this.currentIndex = 0, this.onLoadProgress([]);
      return;
    }
    if (i || !e || r === null)
      this.currentIndex = this.timeline.length - 1;
    else {
      let o = this.timeline.length - 1, n = 1 / 0;
      this.timeline.forEach((h, c) => {
        const l = Math.abs(h.epoch - r);
        l < n && (n = l, o = c);
      }), this.currentIndex = o;
    }
    await this.preloadSlot(this.currentIndex), this.emitCurrent(), this.preloadAllActive();
  }
  getNeededUrlsForSlot(t) {
    const e = [];
    if (t.satellite_key) {
      const i = this.satUrlMap.get(t.satellite_key);
      i && (this.activeFlags.trueColour && e.push(i.true_colour), this.activeFlags.cloudOverlay && e.push(
        this.activeFlags.cloudMode === "solar_cloud" ? i.solar_cloud : i.cloud_mask
      ));
    }
    if (this.activeFlags.radar && t.radar_key) {
      const i = this.radarUrlMap.get(t.radar_key);
      i && e.push(i);
    }
    return e;
  }
  isSlotReady(t) {
    const e = this.timeline[t];
    return e ? this.getNeededUrlsForSlot(e).every((r) => this.blobCache.has(r)) : !1;
  }
  getReadyArray() {
    return this.timeline.map((t, e) => this.isSlotReady(e));
  }
  async fetchAsBlobUrl(t) {
    const e = this.blobCache.get(t);
    if (e) return e;
    const i = this.inFlight.get(t);
    if (i) return i;
    const r = (async () => {
      try {
        const a = this.getHass(), o = a != null && a.fetchWithAuth && t.startsWith("/api/") ? await a.fetchWithAuth(t) : await fetch(t, { credentials: "same-origin" });
        if (!o.ok) return null;
        const n = await o.blob();
        if (this.destroyed) return null;
        const h = URL.createObjectURL(n);
        return this.blobCache.set(t, h), h;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(t);
      }
    })();
    return this.inFlight.set(t, r), r;
  }
  async preloadSlot(t) {
    const e = this.timeline[t];
    if (!e) return;
    const i = this.getNeededUrlsForSlot(e);
    await Promise.all(i.map((r) => this.fetchAsBlobUrl(r))), this.destroyed || this.onLoadProgress(this.getReadyArray());
  }
  async preloadAllActive() {
    const t = this.timeline.map((i, r) => r).reverse(), e = 4;
    for (let i = 0; i < t.length; i += e) {
      if (this.destroyed) return;
      const r = t.slice(i, i + e);
      await Promise.all(r.map((a) => this.preloadSlot(a)));
    }
  }
  seek(t, e = !1) {
    if (this.timeline.length === 0) return;
    e && this.playing && this.pause();
    const i = Math.max(0, Math.min(this.timeline.length - 1, t));
    if (i === this.currentIndex && !e) {
      this.emitCurrent();
      return;
    }
    this.currentIndex = i, this.isSlotReady(i) || this.preloadSlot(i).then(() => {
      !this.destroyed && this.currentIndex === i && this.emitCurrent();
    }), this.emitCurrent();
  }
  step(t) {
    if (this.timeline.length === 0) return;
    this.pause();
    const e = (this.currentIndex + t + this.timeline.length) % this.timeline.length;
    this.seek(e, !1);
  }
  play(t = !1) {
    var e;
    this.timeline.length <= 1 || (this.timerId !== null && (window.clearTimeout(this.timerId), this.timerId = null), this.singleLoop = t, (t || this.currentIndex >= this.timeline.length - 1) && (this.currentIndex = 0, this.isSlotReady(0) || this.preloadSlot(0).then(() => {
      !this.destroyed && this.currentIndex === 0 && this.emitCurrent();
    }), this.emitCurrent()), this.playing = !0, (e = this.onPlayStateChange) == null || e.call(this, !0), this.scheduleNextTick());
  }
  pause() {
    var e;
    const t = this.playing;
    this.playing = !1, this.singleLoop = !1, this.timerId !== null && (window.clearTimeout(this.timerId), this.timerId = null), t && ((e = this.onPlayStateChange) == null || e.call(this, !1));
  }
  togglePlay() {
    return this.playing ? this.pause() : this.play(!1), this.playing;
  }
  setSpeed(t) {
    this.speed = Math.max(0.25, Math.min(4, t)), this.playing && (this.timerId !== null && window.clearTimeout(this.timerId), this.scheduleNextTick());
  }
  scheduleNextTick() {
    if (!this.playing || this.destroyed || this.timeline.length <= 1) return;
    const t = this.currentIndex >= this.timeline.length - 1;
    if (this.singleLoop && t) {
      this.pause();
      return;
    }
    const e = (this.currentIndex + 1) % this.timeline.length;
    this.isSlotReady(e) || this.preloadSlot(e);
    const i = Math.round(t ? 1350 / this.speed : 420 / this.speed);
    this.timerId = window.setTimeout(() => {
      if (!this.playing || this.destroyed) return;
      const r = (this.currentIndex + 1) % this.timeline.length;
      if (this.currentIndex = r, this.isSlotReady(r) || this.preloadSlot(r).then(() => {
        !this.destroyed && this.currentIndex === r && this.emitCurrent();
      }), this.emitCurrent(), this.singleLoop && r >= this.timeline.length - 1) {
        this.pause();
        return;
      }
      this.scheduleNextTick();
    }, i);
  }
  resolveSafeUrl(t) {
    var i;
    const e = this.blobCache.get(t);
    return e || (t.startsWith("/api/") && ((i = this.getHass()) != null && i.fetchWithAuth) ? null : t);
  }
  emitCurrent() {
    const t = this.timeline[this.currentIndex];
    if (!t) return;
    let e = null, i = null, r = null;
    if (t.satellite_key) {
      const a = this.satUrlMap.get(t.satellite_key);
      if (a) {
        e = this.resolveSafeUrl(a.true_colour);
        const o = this.activeFlags.cloudMode === "solar_cloud" ? a.solar_cloud : a.cloud_mask;
        i = this.resolveSafeUrl(o);
      }
    }
    if (t.radar_key) {
      const a = this.radarUrlMap.get(t.radar_key);
      a && (r = this.resolveSafeUrl(a));
    }
    this.onFrameChange({
      slot: t,
      index: this.currentIndex,
      trueColourBlobUrl: e,
      cloudOverlayBlobUrl: i,
      radarBlobUrl: r
    });
  }
  pruneEvictedBlobs() {
    const t = /* @__PURE__ */ new Set();
    for (const e of this.satUrlMap.values())
      t.add(e.true_colour), t.add(e.cloud_mask), t.add(e.solar_cloud);
    for (const e of this.radarUrlMap.values())
      t.add(e);
    for (const [e, i] of this.blobCache.entries())
      t.has(e) || (URL.revokeObjectURL(i), this.blobCache.delete(e));
  }
  destroy() {
    this.destroyed = !0, this.pause();
    for (const t of this.blobCache.values())
      URL.revokeObjectURL(t);
    this.blobCache.clear();
  }
}
const re = 24;
class Oe {
  constructor(t) {
    this.map = null, this.windData = null, this.level = "850hPa", this.visible = !0, this.opacity = 0.85, this.darkTheme = !0, this.streamlines = [], this.animId = null, this.isMoving = !1, this.destroyed = !1, this.handleMoveStart = () => {
      this.isMoving = !0, this.clearCanvas();
    }, this.handleMoveEnd = () => {
      this.isMoving = !1, this.seedStreamlines();
    }, this.handleResize = () => {
      this.resize(), this.seedStreamlines();
    }, this.tick = () => {
      if (this.destroyed || !this.visible || !this.map || !this.windData) {
        this.animId = null;
        return;
      }
      if (!this.isMoving && this.streamlines.length > 0) {
        this.clearCanvas();
        const i = this.map.getBounds(), r = Math.max(i.getWest(), this.windData.bbox.west), a = Math.min(i.getEast(), this.windData.bbox.east), o = Math.max(i.getSouth(), this.windData.bbox.south), n = Math.min(i.getNorth(), this.windData.bbox.north), h = this.map.getZoom(), c = 105e-6 * Math.pow(2, 7 - h);
        this.ctx.lineCap = "round", this.ctx.lineJoin = "round";
        for (let l = 0; l < this.streamlines.length; l++) {
          const d = this.streamlines[l];
          if (d.age >= d.maxAge) {
            this.streamlines[l] = this.spawnStreamline(r, o, a, n, !1);
            continue;
          }
          const g = this.sampleUV(d.lon, d.lat);
          if (!g) {
            this.streamlines[l] = this.spawnStreamline(r, o, a, n, !1);
            continue;
          }
          const [p, u] = g, w = Math.hypot(p, u);
          if (w < 0.15) {
            d.age += 2;
            continue;
          }
          d.lastSpeedKmh = w * 3.6;
          const x = Math.max(0.35, Math.cos(d.lat * Math.PI / 180));
          if (d.lon += p * c / x, d.lat += u * c, d.age += 1, d.trail.push([d.lon, d.lat]), d.trail.length > re && d.trail.shift(), d.trail.length < 3) continue;
          const E = Math.min(1, d.age / 14), A = Math.min(1, (d.maxAge - d.age) / 18), S = E * A;
          if (S <= 0.03) continue;
          const b = d.trail.map((k) => this.map.project(k)), q = this.resolveRibbonRgb(d.lastSpeedKmh), C = Math.floor(b.length * 0.45);
          this.ctx.strokeStyle = `rgba(${q}, ${(0.22 * S).toFixed(3)})`, this.ctx.lineWidth = 0.9, this.ctx.beginPath(), this.ctx.moveTo(b[0].x, b[0].y);
          for (let k = 1; k <= C; k++)
            this.ctx.lineTo(b[k].x, b[k].y);
          this.ctx.stroke();
          const Z = (this.darkTheme ? 0.58 : 0.62) * S;
          this.ctx.strokeStyle = `rgba(${q}, ${Z.toFixed(3)})`, this.ctx.lineWidth = this.level === "850hPa" ? 1.45 : 1.25, this.ctx.beginPath(), this.ctx.moveTo(b[C].x, b[C].y);
          for (let k = C + 1; k < b.length; k++)
            this.ctx.lineTo(b[k].x, b[k].y);
          this.ctx.stroke();
          const z = b[b.length - 1], X = b[Math.max(0, b.length - 4)], L = z.x - X.x, F = z.y - X.y;
          if (Math.hypot(L, F) >= 3.5) {
            const k = Math.atan2(F, L), O = 4.2, I = 0.52;
            this.ctx.beginPath(), this.ctx.moveTo(
              z.x - O * Math.cos(k - I),
              z.y - O * Math.sin(k - I)
            ), this.ctx.lineTo(z.x, z.y), this.ctx.lineTo(
              z.x - O * Math.cos(k + I),
              z.y - O * Math.sin(k + I)
            ), this.ctx.stroke();
          }
        }
      }
      this.animId = window.requestAnimationFrame(this.tick);
    }, this.canvas = document.createElement("canvas"), this.canvas.style.position = "absolute", this.canvas.style.inset = "0", this.canvas.style.width = "100%", this.canvas.style.height = "100%", this.canvas.style.pointerEvents = "none", this.canvas.style.zIndex = "3", t.appendChild(this.canvas);
    const e = this.canvas.getContext("2d");
    if (!e)
      throw new Error("2D canvas context unavailable");
    this.ctx = e;
  }
  attachMap(t) {
    this.map = t, this.resize(), t.on("movestart", this.handleMoveStart), t.on("moveend", this.handleMoveEnd), t.on("resize", this.handleResize), this.seedStreamlines(), this.updateLoopState();
  }
  resize() {
    var i;
    const t = (i = this.canvas.parentElement) == null ? void 0 : i.getBoundingClientRect();
    if (!t) return;
    const e = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(t.width * e)), this.canvas.height = Math.max(1, Math.round(t.height * e)), this.ctx.setTransform(e, 0, 0, e, 0, 0);
  }
  setWindData(t) {
    this.windData = t, this.seedStreamlines(), this.updateLoopState();
  }
  setOptions(t, e, i, r = !0) {
    const a = this.level !== e || this.darkTheme !== r;
    this.visible = t, this.level = e, this.opacity = i, this.darkTheme = r, this.canvas.style.opacity = String(i), this.canvas.style.display = t ? "block" : "none", a && (this.clearCanvas(), this.seedStreamlines()), this.updateLoopState();
  }
  clearCanvas() {
    const t = Math.min(window.devicePixelRatio || 1, 2);
    this.ctx.clearRect(0, 0, this.canvas.width / t, this.canvas.height / t);
  }
  seedStreamlines() {
    var c;
    if (!this.map || !this.windData) return;
    const t = this.map.getBounds(), e = Math.max(t.getWest(), this.windData.bbox.west), i = Math.min(t.getEast(), this.windData.bbox.east), r = Math.max(t.getSouth(), this.windData.bbox.south), a = Math.min(t.getNorth(), this.windData.bbox.north);
    if (e >= i || r >= a) {
      this.streamlines = [];
      return;
    }
    const o = (c = this.canvas.parentElement) == null ? void 0 : c.getBoundingClientRect(), n = ((o == null ? void 0 : o.width) ?? 500) * ((o == null ? void 0 : o.height) ?? 360), h = Math.max(85, Math.min(155, Math.round(n / 3200)));
    this.streamlines = Array.from(
      { length: h },
      () => this.spawnStreamline(e, r, i, a, !0)
    );
  }
  spawnStreamline(t, e, i, r, a = !1) {
    let o = t + Math.random() * (i - t), n = e + Math.random() * (r - e);
    const h = 95 + Math.floor(Math.random() * 65), c = a ? Math.floor(Math.random() * h) : 0, l = [[o, n]];
    let d = 20;
    if (a && this.map && this.windData) {
      const g = this.map.getZoom(), p = 105e-6 * Math.pow(2, 7 - g), u = Math.min(re - 1, c);
      for (let w = 0; w < u; w++) {
        const x = this.sampleUV(o, n);
        if (!x) break;
        const [E, A] = x, S = Math.hypot(E, A);
        if (S < 0.15) break;
        d = S * 3.6;
        const b = Math.max(0.35, Math.cos(n * Math.PI / 180));
        o += E * p / b, n += A * p, l.push([o, n]);
      }
    }
    return { lon: o, lat: n, age: c, maxAge: h, trail: l, lastSpeedKmh: d };
  }
  sampleUV(t, e) {
    return this.windData ? Ie(this.windData, this.level, t, e) : null;
  }
  updateLoopState() {
    const t = !!(this.visible && this.map && this.windData && !this.destroyed);
    t && this.animId === null ? this.tick() : !t && this.animId !== null && (window.cancelAnimationFrame(this.animId), this.animId = null, this.clearCanvas());
  }
  resolveRibbonRgb(t) {
    return this.darkTheme ? t >= 55 ? "253, 224, 71" : this.level === "850hPa" ? "241, 245, 249" : "167, 243, 208" : t >= 55 ? "180, 83, 9" : this.level === "850hPa" ? "51, 65, 85" : "15, 118, 110";
  }
  destroy() {
    this.destroyed = !0, this.animId !== null && (window.cancelAnimationFrame(this.animId), this.animId = null), this.map && (this.map.off("movestart", this.handleMoveStart), this.map.off("moveend", this.handleMoveEnd), this.map.off("resize", this.handleResize)), this.canvas.remove();
  }
}
function Ie(s, t, e, i) {
  var S, b, q, C;
  const r = ((S = s.levels) == null ? void 0 : S[t]) ?? ((b = s.levels) == null ? void 0 : b["850hPa"]) ?? ((q = s.levels) == null ? void 0 : q["10m"]);
  if (!r || !((C = r.u) != null && C.length)) return null;
  const { bbox: a, rows: o, cols: n } = s;
  if (e < a.west || e > a.east || i < a.south || i > a.north)
    return null;
  const h = (e - a.west) / Math.max(1e-5, a.east - a.west) * (n - 1), c = (i - a.south) / Math.max(1e-5, a.north - a.south) * (o - 1), l = Math.max(0, Math.min(n - 1, Math.floor(h))), d = Math.max(0, Math.min(o - 1, Math.floor(c))), g = Math.min(n - 1, l + 1), p = Math.min(o - 1, d + 1), u = h - l, w = c - d, x = (Z, z) => Z * n + z, E = (r.u[x(d, l)] * (1 - u) + r.u[x(d, g)] * u) * (1 - w) + (r.u[x(p, l)] * (1 - u) + r.u[x(p, g)] * u) * w, A = (r.v[x(d, l)] * (1 - u) + r.v[x(d, g)] * u) * (1 - w) + (r.v[x(p, l)] * (1 - u) + r.v[x(p, g)] * u) * w;
  return [E, A];
}
let ht = null;
async function pe() {
  return ht || (ht = (async () => {
    let s;
    for (let t = 0; t < 3; t++)
      try {
        const e = await import("./solar-sky-radar-maplibre-Cgu4aMgB.js");
        return e.ensureMapLibreWorkerConfigured(), e.maplibregl;
      } catch (e) {
        s = e, t < 2 && await new Promise(
          (i) => globalThis.setTimeout(i, 300 * (t + 1))
        );
      }
    throw ht = null, s;
  })()), ht;
}
function Ue() {
  pe().catch(() => {
  });
}
const Be = "https://tiles.openfreemap.org/styles/dark", He = "https://tiles.openfreemap.org/styles/positron", Ne = 6e3, $t = /* @__PURE__ */ new Map(), K = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", et = {
  type: "FeatureCollection",
  features: []
}, Ve = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW"
];
function De(s, t, e, i) {
  const r = Math.PI / 180, a = s * r, o = e * r, n = (e - s) * r, h = (i - t) * r, c = Math.sin(n / 2) ** 2 + Math.cos(a) * Math.cos(o) * Math.sin(h / 2) ** 2, l = Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(c))) * 10) / 10, d = Math.sin(h) * Math.cos(o), g = Math.cos(a) * Math.sin(o) - Math.sin(a) * Math.cos(o) * Math.cos(h), p = (Math.atan2(d, g) * 180 / Math.PI + 360) % 360, u = Ve[Math.round(p / 22.5) % 16];
  return { distanceKm: l, compass: u };
}
function We(s, t, e) {
  const i = Number(s);
  let r = "";
  Number.isFinite(i) && i >= 0 && (i < 1 ? r = `${Math.max(1, Math.round(i * 60))}m ago` : r = `${i.toFixed(1)}h ago`);
  const a = Number(t);
  if (Number.isFinite(a) && a > 1e9) {
    const o = new Date(a * 1e3);
    let n;
    try {
      n = o.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        ...e ? { timeZone: e } : {}
      });
    } catch {
      n = o.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    }
    return r ? `${r} (${n})` : n;
  }
  return r || "Recent";
}
function je(s) {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "ssr-fallback-bg",
        type: "background",
        paint: { "background-color": s ? "#13281d" : "#d8ebd2" }
      }
    ]
  };
}
function Ze(s, t) {
  const e = structuredClone(s);
  delete e.sprite;
  const i = [], r = [];
  for (const a of e.layers ?? []) {
    const o = a.id.toLowerCase(), n = a, h = String(n["source-layer"] ?? "").toLowerCase(), c = n.layout ?? {}, l = n.paint ?? {};
    if (!(a.type === "symbol" && (o.includes("shield") || o === "highway_name_motorway"))) {
      if (a.type === "symbol" && "icon-image" in c) {
        if (!("text-field" in c))
          continue;
        delete c["icon-image"], delete c["icon-size"], delete c["icon-padding"], delete c["icon-offset"], delete c["icon-anchor"], delete c["icon-optional"];
      }
      if (delete l["icon-opacity"], delete l["icon-color"], delete l["icon-halo-color"], delete l["icon-halo-width"], "fill-pattern" in l && delete l["fill-pattern"], delete l["line-pattern"], delete l["background-pattern"], a.type === "background" ? l["background-color"] = t ? "#13281d" : "#d8ebd2" : a.type === "fill" && (o === "water" || h === "water" ? (l["fill-color"] = t ? "#0e2f52" : "#7cc0ec", l["fill-antialias"] = !0) : o.includes("wood") || o.includes("forest") ? l["fill-color"] = t ? "#1d3f2d" : "#b2d8a8" : o.includes("park") || o.includes("grass") || o.includes("wetland") ? l["fill-color"] = t ? "#183626" : "#c2e2ba" : o.includes("residential") ? l["fill-color"] = t ? "rgba(24, 49, 36, 0.45)" : "rgba(198, 222, 192, 0.45)" : o.includes("building") ? (l["fill-color"] = t ? "#183124" : "#cbe0c4", l["fill-outline-color"] = t ? "#214231" : "#b8d2b0") : o.includes("pier") ? l["fill-color"] = t ? "#1b3628" : "#cfe3c8" : o.includes("aeroway") ? l["fill-color"] = t ? "rgba(22, 43, 32, 0.72)" : "rgba(214, 231, 210, 0.72)" : (o.includes("ice") || o.includes("glacier")) && (l["fill-color"] = t ? "#1c3b4d" : "#e6f4f8")), a.type === "line" && (h === "waterway" || o.includes("waterway") ? l["line-color"] = t ? "#1b5084" : "#55a5df" : o.includes("highway_major") || o.includes("highway_motorway") ? o.includes("casing") ? l["line-color"] = t ? "rgba(9, 16, 14, 0.62)" : "rgba(100, 116, 139, 0.48)" : l["line-color"] = t ? "rgba(226, 232, 240, 0.48)" : "rgba(255, 255, 255, 0.64)" : o.includes("boundary") ? l["line-color"] = t ? "rgba(203, 213, 225, 0.46)" : "rgba(51, 65, 85, 0.44)" : (h === "transportation" || h === "aeroway" || o.includes("railway")) && (l["line-color"] = t ? "rgba(96, 132, 112, 0.24)" : "rgba(138, 168, 134, 0.36)")), a.type === "symbol" && "text-field" in c) {
        const d = "rgba(9, 16, 14, 0.95)", g = "rgba(255, 255, 255, 0.96)";
        o.includes("city_capital") || o.includes("city_large") ? (c["text-font"] = ["Noto Sans Bold"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          13.5,
          7,
          16,
          11,
          19.5
        ], l["text-color"] = t ? "#ffffff" : "#0f172a", l["text-halo-color"] = t ? d : g, l["text-halo-width"] = 2.2, l["text-halo-blur"] = 0.2) : o.includes("city") ? (c["text-font"] = ["Noto Sans Bold"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          12.5,
          7,
          14.5,
          11,
          17.5
        ], l["text-color"] = t ? "#f8fafc" : "#0f172a", l["text-halo-color"] = t ? d : g, l["text-halo-width"] = 2.1, l["text-halo-blur"] = 0.2) : o.includes("town") ? (c["text-font"] = ["Noto Sans Bold"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          12,
          8,
          13.5,
          11,
          15.5
        ], l["text-color"] = t ? "#f8fafc" : "#0f172a", l["text-halo-color"] = t ? d : g, l["text-halo-width"] = 2, l["text-halo-blur"] = 0.2) : o.includes("suburb") || o.includes("village") || o.includes("other") || o.includes("airport") ? (c["text-font"] = ["Noto Sans Regular"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          11.5,
          10,
          13,
          13,
          14.5
        ], l["text-color"] = t ? "#f1f5f9" : "#1e293b", l["text-halo-color"] = t ? "rgba(9, 16, 14, 0.93)" : "rgba(255, 255, 255, 0.95)", l["text-halo-width"] = 1.9, l["text-halo-blur"] = 0.2) : o.includes("state") || o.includes("country") ? (c["text-font"] = o.includes("country") ? ["Noto Sans Bold"] : ["Noto Sans Regular"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          11,
          7,
          13.5
        ], l["text-color"] = t ? "#cbd5e1" : "#334155", l["text-halo-color"] = t ? "rgba(9, 16, 14, 0.9)" : "rgba(255, 255, 255, 0.93)", l["text-halo-width"] = 1.85, l["text-halo-blur"] = 0.2) : o.includes("water") ? (c["text-font"] = ["Noto Sans Italic"], l["text-color"] = t ? "#93c5fd" : "#1d4ed8", l["text-halo-color"] = t ? "rgba(8, 22, 38, 0.92)" : "rgba(255, 255, 255, 0.92)", l["text-halo-width"] = 1.75, l["text-halo-blur"] = 0.2) : (c["text-font"] = ["Noto Sans Regular"], c["text-size"] = [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          11,
          14,
          13
        ], l["text-color"] = t ? "#e2e8f0" : "#1e293b", l["text-halo-color"] = t ? "rgba(9, 16, 14, 0.92)" : "rgba(255, 255, 255, 0.94)", l["text-halo-width"] = 1.75, l["text-halo-blur"] = 0.2), n.layout = c, n.paint = l, r.push(a);
        continue;
      }
      Object.keys(c).length > 0 && (n.layout = c), Object.keys(l).length > 0 && (n.paint = l), a.type === "symbol" ? r.push(a) : i.push(a);
    }
  }
  return e.layers = [...i, ...r], e;
}
async function Ke(s, t, e = Ne) {
  const i = `${s}::${t ? "dark" : "light"}`;
  let r = $t.get(i);
  r || (r = (async () => {
    const a = typeof AbortController < "u" ? new AbortController() : null, o = a && e > 0 ? globalThis.setTimeout(() => a.abort(), e) : null;
    try {
      const n = await fetch(s, {
        mode: "cors",
        ...a ? { signal: a.signal } : {}
      });
      if (!n.ok) throw new Error(`HTTP ${n.status}`);
      const h = await n.json();
      return Ze(h, t);
    } finally {
      o !== null && globalThis.clearTimeout(o);
    }
  })(), $t.set(i, r));
  try {
    const a = await r;
    return { style: structuredClone(a), isFallback: !1 };
  } catch {
    return $t.delete(i), { style: je(t), isFallback: !0 };
  }
}
function Ge(s, t, e, i) {
  const r = {
    "bom-base": {
      type: "raster",
      tiles: [t],
      tileSize: 256,
      maxzoom: 10,
      attribution: "© Australian Bureau of Meteorology"
    }
  }, a = [
    {
      id: "bom-background",
      type: "background",
      paint: { "background-color": s ? "#13281d" : "#d8ebd2" }
    },
    {
      id: "bom-base-layer",
      type: "raster",
      source: "bom-base",
      paint: { "raster-opacity": 1 }
    }
  ];
  return i && (r["bom-borders"] = {
    type: "raster",
    tiles: [i],
    tileSize: 256,
    maxzoom: 10
  }, a.push({
    id: "bom-borders-top",
    type: "raster",
    source: "bom-borders",
    paint: { "raster-opacity": 0.75 }
  })), e && (r["bom-towns"] = {
    type: "raster",
    tiles: [e],
    tileSize: 256,
    maxzoom: 10
  }, a.push({
    id: "bom-towns-label-top",
    type: "raster",
    source: "bom-towns",
    paint: { "raster-opacity": 0.95 }
  })), { version: 8, sources: r, layers: a };
}
function N(s, t) {
  var i;
  const e = s ?? "auto";
  return e === "dark" || e === "bom_dark" ? !0 : e === "light" || e === "bom_light" ? !1 : typeof ((i = t == null ? void 0 : t.themes) == null ? void 0 : i.darkMode) == "boolean" ? t.themes.darkMode : typeof window < "u" && typeof window.matchMedia == "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : !0;
}
class Je {
  constructor(t, e, i, r) {
    this.container = t, this.getHass = e, this.onMapInteract = i, this.onStatusError = r, this.ml = null, this.map = null, this.windRenderer = null, this.resizeObserver = null, this.homeMarker = null, this.hoverPopup = null, this.pinnedPopup = null, this.hoveredFireId = "", this.pinnedFireId = "", this.locked = !0, this.styleReady = !1, this.currentStyleKey = "", this.usingFallbackBasemap = !1, this.styleSeq = 0, this.mountPromise = null, this.upgradeTimer = null, this.postMountTimers = [], this.appliedUrls = { tc: "", vc: "", rad: "" }, this.appliedCoordsKey = "", this.manifest = null, this.wind = null, this.hazards = null, this.latestFrame = null, this.destroyed = !1, this.remounting = !1, this.handleOnline = () => {
      if (!this.destroyed) {
        if (!this.map && !this.remounting) {
          this.remountMap();
          return;
        }
        this.usingFallbackBasemap && this.tryUpgradeFallbackBasemap();
      }
    }, this.handleVisibilityOrWake = () => {
      if (this.destroyed || typeof document < "u" && document.visibilityState === "hidden")
        return;
      if (!this.map && !this.remounting) {
        this.remountMap();
        return;
      }
      this.safeResize(), this.ensureOverlayLayers(), this.syncAllState(), this.usingFallbackBasemap && this.tryUpgradeFallbackBasemap();
      const a = globalThis.setTimeout(() => {
        this.destroyed || this.remounting || !this.map || (this.isWebGLContextLost() ? this.remountMap() : (this.safeResize(), this.map.triggerRepaint()));
      }, 350);
      this.postMountTimers.push(a);
    };
  }
  init(t) {
    this.config = t, this.locked = t.lock_map ?? !0, this.attachLifecycleListeners(), this.mountPromise = this.mountInitialMap();
  }
  handleReconnect() {
    if (!this.destroyed) {
      if (!this.map && !this.mountPromise) {
        this.mountPromise = this.mountInitialMap();
        return;
      }
      this.safeResize(), this.schedulePostMountResizes();
    }
  }
  attachLifecycleListeners() {
    typeof document < "u" && document.addEventListener("visibilitychange", this.handleVisibilityOrWake), typeof window < "u" && (window.addEventListener("pageshow", this.handleVisibilityOrWake), window.addEventListener("online", this.handleOnline));
  }
  detachLifecycleListeners() {
    typeof document < "u" && document.removeEventListener("visibilitychange", this.handleVisibilityOrWake), typeof window < "u" && (window.removeEventListener("pageshow", this.handleVisibilityOrWake), window.removeEventListener("online", this.handleOnline));
  }
  isWebGLContextLost() {
    if (!this.map) return !1;
    try {
      const t = this.map.getCanvas(), e = t.getContext("webgl2") || t.getContext("webgl") || t.getContext("experimental-webgl");
      if (e && "isContextLost" in e && typeof e.isContextLost == "function")
        return !!e.isContextLost();
    } catch {
    }
    return !1;
  }
  safeResize() {
    var t;
    if (!(this.destroyed || !this.map) && !(this.container.clientWidth <= 0 || this.container.clientHeight <= 0))
      try {
        this.map.resize(), (t = this.windRenderer) == null || t.resize();
      } catch {
      }
  }
  clearPostMountTimers() {
    for (const t of this.postMountTimers)
      globalThis.clearTimeout(t);
    this.postMountTimers = [], this.upgradeTimer !== null && (globalThis.clearTimeout(this.upgradeTimer), this.upgradeTimer = null);
  }
  schedulePostMountResizes() {
    typeof requestAnimationFrame == "function" && requestAnimationFrame(() => this.safeResize());
    for (const t of [120, 450]) {
      const e = globalThis.setTimeout(() => this.safeResize(), t);
      this.postMountTimers.push(e);
    }
  }
  async waitForNonZeroContainer(t = 600) {
    this.container.clientWidth > 0 && this.container.clientHeight > 0 || typeof ResizeObserver > "u" || await new Promise((e) => {
      let i = !1;
      const r = () => {
        i || (i = !0, a.disconnect(), globalThis.clearTimeout(o), e());
      }, a = new ResizeObserver(() => {
        this.container.clientWidth > 0 && this.container.clientHeight > 0 && r();
      });
      a.observe(this.container);
      const o = globalThis.setTimeout(r, t);
    });
  }
  get isLocked() {
    return this.locked;
  }
  setLocked(t, e = !0) {
    if (this.locked = t, this.applyLockState(), t && e && this.map) {
      const [i, r] = this.getHomeLatLon();
      this.map.flyTo({
        center: [r, i],
        duration: 480
      });
    }
  }
  applyLockState() {
    var i, r;
    if (!this.map) return;
    const t = this.map.getCanvasContainer(), e = this.map.getCanvas();
    this.locked ? (this.map.dragPan.disable(), this.map.scrollZoom.disable(), this.map.boxZoom.disable(), this.map.doubleClickZoom.disable(), this.map.keyboard.disable(), this.map.touchZoomRotate.disable(), (i = this.map.touchPitch) == null || i.disable(), t.classList.remove(
      "maplibregl-interactive",
      "maplibregl-touch-drag-pan",
      "maplibregl-touch-zoom-rotate"
    ), this.container.style.touchAction = "pan-y", t.style.touchAction = "pan-y", e.style.touchAction = "pan-y", this.hoveredFireId || (e.style.cursor = "default")) : (this.map.dragPan.enable(), this.map.scrollZoom.enable(), this.map.doubleClickZoom.enable(), this.map.keyboard.enable(), this.map.touchZoomRotate.enable(), this.map.touchZoomRotate.disableRotation(), (r = this.map.touchPitch) == null || r.disable(), t.classList.add(
      "maplibregl-interactive",
      "maplibregl-touch-drag-pan",
      "maplibregl-touch-zoom-rotate"
    ), this.container.style.touchAction = "none", t.style.touchAction = "none", e.style.touchAction = "none", this.hoveredFireId || (e.style.cursor = ""));
  }
  getHomeLatLon() {
    var i, r, a, o, n, h;
    const t = this.config.center_latitude ?? ((i = this.manifest) == null ? void 0 : i.location.latitude) ?? ((a = (r = this.getHass()) == null ? void 0 : r.config) == null ? void 0 : a.latitude) ?? -37.8136, e = this.config.center_longitude ?? ((o = this.manifest) == null ? void 0 : o.location.longitude) ?? ((h = (n = this.getHass()) == null ? void 0 : n.config) == null ? void 0 : h.longitude) ?? 144.9631;
    return [t, e];
  }
  computeStyleKey(t) {
    var r;
    const e = N(t, this.getHass()), i = (r = this.manifest) == null ? void 0 : r.providers.basemap;
    return (t === "bom_dark" || t === "bom_light") && i && (t === "bom_dark" ? i.bom_dark_tiles : i.bom_light_tiles) ? { styleKey: t, isDark: t === "bom_dark" } : { styleKey: e ? "ofm_dark" : "ofm_light", isDark: e };
  }
  async resolveStyleSpec(t) {
    var h;
    const { styleKey: e, isDark: i } = this.computeStyleKey(t), r = (h = this.manifest) == null ? void 0 : h.providers.basemap;
    if ((e === "bom_dark" || e === "bom_light") && r) {
      const c = e === "bom_dark" ? r.bom_dark_tiles : r.bom_light_tiles;
      return {
        styleKey: e,
        isDark: i,
        styleSpec: Ge(
          e === "bom_dark",
          c,
          r.bom_towns_overlay,
          r.bom_borders_overlay
        ),
        isFallback: !1
      };
    }
    const a = i ? Be : He, { style: o, isFallback: n } = await Ke(a, i);
    return { styleKey: e, isDark: i, styleSpec: o, isFallback: n };
  }
  scheduleFallbackBasemapUpgrade(t = 4500) {
    this.destroyed || this.upgradeTimer !== null || (this.upgradeTimer = globalThis.setTimeout(() => {
      this.upgradeTimer = null, this.tryUpgradeFallbackBasemap();
    }, t));
  }
  async tryUpgradeFallbackBasemap() {
    if (this.destroyed || !this.map || !this.usingFallbackBasemap) return;
    const t = this.config.basemap_theme ?? "auto", e = ++this.styleSeq, i = await this.resolveStyleSpec(t);
    if (!(this.destroyed || !this.map || e !== this.styleSeq)) {
      if (i.isFallback) {
        this.scheduleFallbackBasemapUpgrade(8e3);
        return;
      }
      this.usingFallbackBasemap = !1, this.currentStyleKey = i.styleKey, this.styleReady = !1, this.appliedUrls = { tc: "", vc: "", rad: "" }, this.map.setStyle(i.styleSpec, { diff: !1 });
    }
  }
  teardownMapOnly() {
    var t, e, i, r, a, o;
    this.clearPostMountTimers(), (t = this.resizeObserver) == null || t.disconnect(), this.resizeObserver = null, (e = this.windRenderer) == null || e.destroy(), this.windRenderer = null, (i = this.hoverPopup) == null || i.remove(), this.hoverPopup = null, (r = this.pinnedPopup) == null || r.remove(), this.pinnedPopup = null, (a = this.homeMarker) == null || a.remove(), this.homeMarker = null;
    try {
      (o = this.map) == null || o.remove();
    } catch {
    }
    this.map = null, this.container.replaceChildren(), this.container.classList.remove("maplibregl-map"), this.styleReady = !1, this.appliedUrls = { tc: "", vc: "", rad: "" }, this.appliedCoordsKey = "";
  }
  async remountMap() {
    if (!(this.destroyed || this.remounting)) {
      this.remounting = !0;
      try {
        this.teardownMapOnly(), this.mountPromise = this.mountInitialMap(), await this.mountPromise;
      } finally {
        this.remounting = !1;
      }
    }
  }
  async mountInitialMap() {
    var e, i;
    const t = ++this.styleSeq;
    try {
      const [r, a] = await Promise.all([
        pe(),
        this.resolveStyleSpec(this.config.basemap_theme ?? "auto"),
        this.waitForNonZeroContainer(600)
      ]);
      if (this.destroyed) return;
      this.ml = r;
      const { styleKey: o, isDark: n, styleSpec: h, isFallback: c } = a;
      this.currentStyleKey = o, this.usingFallbackBasemap = c;
      const [l, d] = this.getHomeLatLon(), g = this.config.zoom_level ?? 7.2;
      this.container.replaceChildren(), this.container.classList.remove("maplibregl-map"), this.map = new r.Map({
        container: this.container,
        style: h,
        center: [d, l],
        zoom: g,
        minZoom: 3,
        maxZoom: 12,
        localIdeographFontFamily: !1,
        attributionControl: !1,
        pitchWithRotate: !1,
        dragRotate: !1,
        transformRequest: (x) => {
          var S, b;
          const E = (S = this.getHass()) == null ? void 0 : S.auth, A = ((b = E == null ? void 0 : E.data) == null ? void 0 : b.access_token) ?? (E == null ? void 0 : E.accessToken);
          return A && x.startsWith("/") && x.includes("/api/") ? {
            url: `${window.location.origin}${x}`,
            headers: { Authorization: `Bearer ${A}` }
          } : { url: x };
        }
      }), (e = this.onStatusError) == null || e.call(this, null);
      const p = this.map.getCanvas();
      p.addEventListener("webglcontextlost", (x) => {
        x.preventDefault(), this.styleReady = !1;
      }), p.addEventListener("webglcontextrestored", () => {
        this.destroyed || !this.map || (this.styleReady = !1, this.appliedUrls = { tc: "", vc: "", rad: "" }, this.appliedCoordsKey = "", this.ensureOverlayLayers(), this.safeResize(), this.map.triggerRepaint());
      }), this.windRenderer = new Oe(this.container), this.windRenderer.attachMap(this.map), this.wind && this.windRenderer.setWindData(this.wind), this.windRenderer.setOptions(
        this.config.show_wind ?? !0,
        this.config.wind_level ?? "850hPa",
        this.config.wind_opacity ?? 0.85,
        n
      );
      const u = () => this.ensureOverlayLayers();
      this.map.on("style.load", u), this.map.on("load", u), this.map.on("idle", u), this.map.isStyleLoaded() && u(), this.attachHazardHoverAndClickHandlers(), this.applyLockState(), this.onMapInteract && (this.map.on("dragstart", this.onMapInteract), this.map.on("click", this.onMapInteract)), this.updateHomeMarker(l, d), typeof ResizeObserver < "u" && (this.resizeObserver = new ResizeObserver(() => {
        this.safeResize();
      }), this.resizeObserver.observe(this.container)), this.schedulePostMountResizes(), c && this.scheduleFallbackBasemapUpgrade(4500);
      const w = this.computeStyleKey(
        this.config.basemap_theme ?? "auto"
      ).styleKey;
      t === this.styleSeq && w !== this.currentStyleKey && this.applyStyleChange(this.config.basemap_theme ?? "auto");
    } catch (r) {
      if (this.mountPromise = null, !this.destroyed) {
        const a = r instanceof Error ? r.message : "WebGL map engine unavailable";
        (i = this.onStatusError) == null || i.call(this, `Map engine failed to initialize (${a})`);
      }
    }
  }
  queryFireFeatureAtPoint(t) {
    if (!this.map) return null;
    const e = [];
    return this.map.getLayer("ssr-fires-core") && e.push("ssr-fires-core"), this.map.getLayer("ssr-fires-glow") && e.push("ssr-fires-glow"), e.length === 0 ? null : this.map.queryRenderedFeatures(t.point, { layers: e })[0] ?? null;
  }
  buildFirePopupNode(t, e, i) {
    var Ht, Nt;
    const r = document.createElement("div");
    r.className = "ssr-fire-tooltip";
    const a = document.createElement("div");
    a.className = "ssr-fire-header";
    const o = document.createElement("div");
    o.className = "ssr-fire-title";
    const n = String(t.incident_title ?? "").trim(), h = String(t.fire_type ?? "").trim(), c = String(t.state ?? "").trim();
    o.textContent = n || h || (c ? `Thermal Hotspot · ${c}` : "Active Fire Hotspot"), a.appendChild(o);
    const l = document.createElement("span"), d = String(t.alert_level ?? "").trim(), g = String(t.kind ?? ""), p = String(t.intensity ?? "").trim();
    let u = "hotspot", w = p || "Hotspot";
    if (d) {
      w = d;
      const f = d.toLowerCase();
      f.includes("emergency") ? u = "emergency" : f.includes("watch") ? u = "watch" : u = "advice";
    } else g === "planned_burn" || h.toLowerCase().includes("burn") ? (w = "Planned Burn", u = "burn") : h ? (w = h, u = "bushfire") : p && (w = `${p} FRP`, u = p === "Extreme" || p === "High" ? "bushfire" : "hotspot");
    l.className = `ssr-fire-badge ssr-fire-badge-${u}`, l.textContent = w, a.appendChild(l), r.appendChild(a);
    const [x, E] = this.getHomeLatLon(), { distanceKm: A, compass: S } = De(
      x,
      E,
      e[1],
      e[0]
    ), b = document.createElement("div");
    b.className = "ssr-fire-sub", b.textContent = `${A} km ${S} from home · ${e[1].toFixed(3)}°, ${e[0].toFixed(3)}°`, r.appendChild(b);
    const q = document.createElement("div");
    q.className = "ssr-fire-grid";
    const C = (f, Vt) => {
      if (!Vt) return;
      const ct = document.createElement("div");
      ct.className = "ssr-fire-row";
      const vt = document.createElement("span");
      vt.className = "ssr-fire-k", vt.textContent = f;
      const yt = document.createElement("span");
      yt.className = "ssr-fire-v", yt.textContent = Vt, ct.appendChild(vt), ct.appendChild(yt), q.appendChild(ct);
    }, Z = String(t.incident_status ?? "").trim();
    Z && C("Status", Z);
    const z = String(t.size_text ?? "").trim(), X = String(t.council_area ?? "").trim();
    (z || X) && C("Area / LGA", [z, X].filter(Boolean).join(" · "));
    const L = String(t.incident_agency ?? "").trim(), F = Number(t.resources ?? 0);
    if (L || F > 0) {
      const f = F > 0 ? `${F} appliance${F === 1 ? "" : "s"}` : "";
      C("Agency", [L, f].filter(Boolean).join(" · "));
    }
    const Q = Number(t.frp_mw);
    Number.isFinite(Q) && Q > 0 && C(
      "Radiative Power",
      p && p !== "Ground Report" ? `${Q.toFixed(1)} MW (${p})` : `${Q.toFixed(1)} MW`
    );
    const k = Number(t.temp_kelvin);
    if (Number.isFinite(k) && k > 150) {
      const f = (k - 273.15).toFixed(1);
      C("Brightness Temp", `${f} °C (${k.toFixed(1)} K)`);
    }
    const O = String(t.satellite ?? "").trim(), I = String(t.instrument ?? "").trim(), Ot = String(t.accuracy ?? "").trim();
    if (O || I) {
      const f = [O, I].filter(Boolean).join(" · ");
      C("Sensor", Ot ? `${f} (${Ot})` : f);
    }
    const ft = String(t.confidence ?? "").trim(), It = String(t.daynight ?? "").trim();
    if (ft) {
      const f = ft.charAt(0).toUpperCase() + ft.slice(1);
      C(
        "Confidence",
        It ? `${f} · ${It}` : f
      );
    }
    C(
      "Updated",
      We(t.hours_ago, t.epoch, (Nt = (Ht = this.getHass()) == null ? void 0 : Ht.config) == null ? void 0 : Nt.time_zone)
    );
    const bt = String(t.provider ?? "").trim();
    if (bt) {
      const f = [bt];
      L && !bt.toLowerCase().includes(L.toLowerCase()) && f.push(L), C("Source", f.join(" + "));
    }
    r.appendChild(q);
    const Ut = String(t.incident_url ?? "").trim(), Bt = Ut.startsWith("https://");
    if (i && Bt) {
      const f = document.createElement("a");
      f.className = "ssr-fire-link", f.href = Ut, f.target = "_blank", f.rel = "noopener noreferrer", f.textContent = "Open official incident report ↗", r.appendChild(f);
    } else if (!i && Bt) {
      const f = document.createElement("div");
      f.className = "ssr-fire-hint", f.textContent = "Click hotspot to pin & open incident link", r.appendChild(f);
    }
    return r;
  }
  attachHazardHoverAndClickHandlers() {
    this.map && (this.map.on("mousemove", (t) => {
      var n, h, c;
      if (!this.map) return;
      const e = this.queryFireFeatureAtPoint(t);
      if (!e || e.geometry.type !== "Point") {
        this.hoveredFireId && (this.hoveredFireId = "", this.map.getCanvas().style.cursor = this.locked ? "default" : ""), (n = this.hoverPopup) == null || n.remove(), this.hoverPopup = null;
        return;
      }
      this.map.getCanvas().style.cursor = "pointer";
      const i = e.properties ?? {}, r = String(i.id ?? `${e.geometry.coordinates[0]},${e.geometry.coordinates[1]}`);
      if (this.pinnedPopup && this.pinnedFireId === r) {
        (h = this.hoverPopup) == null || h.remove(), this.hoverPopup = null;
        return;
      }
      if (this.hoveredFireId === r && this.hoverPopup)
        return;
      this.hoveredFireId = r;
      const a = e.geometry.coordinates.slice(0, 2), o = this.buildFirePopupNode(i, a, !1);
      (c = this.hoverPopup) == null || c.remove(), this.ml && (this.hoverPopup = new this.ml.Popup({
        closeButton: !1,
        closeOnClick: !1,
        offset: 12,
        maxWidth: "290px",
        className: "ssr-map-popup ssr-map-popup-hover"
      }).setLngLat(a).setDOMContent(o).addTo(this.map));
    }), this.map.on("mouseout", () => {
      var t;
      this.hoveredFireId = "", this.map && (this.map.getCanvas().style.cursor = this.locked ? "default" : ""), (t = this.hoverPopup) == null || t.remove(), this.hoverPopup = null;
    }), this.map.on("click", (t) => {
      var n, h, c;
      if (!this.map) return;
      const e = this.queryFireFeatureAtPoint(t);
      if (!e || e.geometry.type !== "Point") {
        this.pinnedFireId = "", (n = this.pinnedPopup) == null || n.remove(), this.pinnedPopup = null;
        return;
      }
      const i = e.properties ?? {}, r = String(i.id ?? `${e.geometry.coordinates[0]},${e.geometry.coordinates[1]}`), a = e.geometry.coordinates.slice(0, 2);
      if ((h = this.hoverPopup) == null || h.remove(), this.hoverPopup = null, (c = this.pinnedPopup) == null || c.remove(), this.pinnedFireId = r, !this.ml) return;
      const o = this.buildFirePopupNode(i, a, !0);
      this.pinnedPopup = new this.ml.Popup({
        closeButton: !0,
        closeOnClick: !1,
        offset: 12,
        maxWidth: "300px",
        className: "ssr-map-popup ssr-map-popup-pinned"
      }).setLngLat(a).setDOMContent(o).addTo(this.map), this.pinnedPopup.on("close", () => {
        this.pinnedFireId === r && (this.pinnedFireId = "");
      });
    }));
  }
  async applyStyleChange(t) {
    if (this.mountPromise && await this.mountPromise, !this.map || this.destroyed) return;
    const { styleKey: e } = this.computeStyleKey(t);
    if (e === this.currentStyleKey) return;
    const i = ++this.styleSeq, r = await this.resolveStyleSpec(t);
    this.destroyed || !this.map || i !== this.styleSeq || (this.currentStyleKey = r.styleKey, this.usingFallbackBasemap = r.isFallback, this.styleReady = !1, this.appliedUrls = { tc: "", vc: "", rad: "" }, this.map.setStyle(r.styleSpec, { diff: !1 }), r.isFallback && this.scheduleFallbackBasemapUpgrade(4500));
  }
  ensureOverlayLayers() {
    !this.map || this.destroyed || this.map.getSource("ssr-true-colour") || (this.appliedUrls = { tc: "", vc: "", rad: "" }, this.appliedCoordsKey = "", this.styleReady = !0, this.setupOverlayLayers(), this.syncAllState());
  }
  /**
   * Find the first major road/boundary/symbol layer AFTER all `fill` polygons so weather
   * rasters sit above land/water/building fills while major roads, borders, and crisp town
   * labels stay sharp ON TOP of clouds & radar.
   */
  findOverlayAnchorLayerId() {
    var r;
    if (!this.map) return;
    const t = ((r = this.map.getStyle()) == null ? void 0 : r.layers) ?? [], e = t.find(
      (a) => a.id === "bom-borders-top" || a.id === "bom-towns-label-top"
    );
    if (e) return e.id;
    let i = -1;
    for (let a = 0; a < t.length; a++)
      t[a].type === "fill" && (i = a);
    for (let a = i + 1; a < t.length; a++) {
      const o = t[a], n = o.id.toLowerCase();
      if (o.type === "symbol" || n.includes("highway_major") || n.includes("highway_motorway") || n.includes("boundary"))
        return o.id;
    }
  }
  findFirstSymbolLayerId() {
    var i;
    if (!this.map) return;
    const e = (((i = this.map.getStyle()) == null ? void 0 : i.layers) ?? []).find(
      (r) => r.type === "symbol" || r.id === "bom-towns-label-top"
    );
    return e == null ? void 0 : e.id;
  }
  defaultCoords() {
    var i, r;
    if ((r = (i = this.manifest) == null ? void 0 : i.bbox) != null && r.coordinates)
      return this.manifest.bbox.coordinates;
    const [t, e] = this.getHomeLatLon();
    return [
      [e - 4.4, t + 3.5],
      [e + 4.4, t + 3.5],
      [e + 4.4, t - 3.5],
      [e - 4.4, t - 3.5]
    ];
  }
  setupOverlayLayers() {
    var c, l, d, g, p, u, w;
    if (!this.map || this.map.getSource("ssr-true-colour")) return;
    const t = this.findOverlayAnchorLayerId(), e = this.findFirstSymbolLayerId(), i = this.defaultCoords();
    this.appliedCoordsKey = JSON.stringify(i);
    const r = N(this.config.basemap_theme, this.getHass()), a = (this.config.show_true_colour ?? !0) && ((c = this.latestFrame) != null && c.trueColourBlobUrl) ? this.latestFrame.trueColourBlobUrl : K, o = (this.config.show_cloud_overlay ?? !1) && ((l = this.latestFrame) != null && l.cloudOverlayBlobUrl) ? this.latestFrame.cloudOverlayBlobUrl : K, n = (this.config.show_radar ?? !0) && ((d = this.latestFrame) != null && d.radarBlobUrl) ? this.latestFrame.radarBlobUrl : K;
    if (this.appliedUrls = {
      tc: a === K ? "" : a,
      vc: o === K ? "" : o,
      rad: n === K ? "" : n
    }, this.map.addSource("ssr-true-colour", {
      type: "image",
      url: a,
      coordinates: i
    }), this.map.addLayer(
      {
        id: "ssr-true-colour-layer",
        type: "raster",
        source: "ssr-true-colour",
        layout: {
          visibility: this.config.show_true_colour ?? !0 ? "visible" : "none"
        },
        paint: {
          "raster-opacity": this.config.true_colour_opacity ?? 1,
          "raster-fade-duration": 0,
          "raster-resampling": "linear"
        }
      },
      t
    ), this.map.addSource("ssr-visual-cloud", {
      type: "image",
      url: o,
      coordinates: i
    }), this.map.addLayer(
      {
        id: "ssr-visual-cloud-layer",
        type: "raster",
        source: "ssr-visual-cloud",
        layout: {
          visibility: this.config.show_cloud_overlay ?? !1 ? "visible" : "none"
        },
        paint: {
          "raster-opacity": this.config.cloud_opacity ?? 0.58,
          "raster-fade-duration": 0,
          "raster-resampling": "linear"
        }
      },
      t
    ), this.map.addSource("ssr-radar", {
      type: "image",
      url: n,
      coordinates: i
    }), this.map.addLayer(
      {
        id: "ssr-radar-layer",
        type: "raster",
        source: "ssr-radar",
        paint: {
          "raster-opacity": this.config.radar_opacity ?? 0.84,
          "raster-fade-duration": 0,
          "raster-resampling": "linear"
        }
      },
      t
    ), (((g = this.map.getStyle()) == null ? void 0 : g.sources) ?? {}).openmaptiles && !this.map.getLayer("ssr-coastline-crisp"))
      try {
        this.map.addLayer(
          {
            id: "ssr-coastline-crisp",
            type: "line",
            source: "openmaptiles",
            "source-layer": "water",
            paint: {
              "line-color": r ? "rgba(96, 165, 250, 0.52)" : "rgba(25, 76, 130, 0.56)",
              "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.75, 9, 1.4]
            }
          },
          t
        );
      } catch {
      }
    this.map.addSource("ssr-solar-arcs", {
      type: "geojson",
      data: ((u = (p = this.manifest) == null ? void 0 : p.solar) == null ? void 0 : u.arrival_arcs_geojson) ?? et
    }), this.map.addLayer(
      {
        id: "ssr-solar-arcs-line",
        type: "line",
        source: "ssr-solar-arcs",
        filter: ["==", ["get", "kind"], "arrival_arc"],
        paint: {
          "line-color": [
            "match",
            ["get", "minutes"],
            15,
            r ? "#38bdf8" : "#0284c7",
            30,
            r ? "#fbbf24" : "#d97706",
            r ? "#f87171" : "#dc2626"
          ],
          "line-width": 2,
          "line-dasharray": [3, 2.5],
          "line-opacity": 0.9
        }
      },
      e
    ), this.map.addLayer(
      {
        id: "ssr-solar-vector-line",
        type: "line",
        source: "ssr-solar-arcs",
        filter: ["==", ["get", "kind"], "approach_vector"],
        paint: {
          "line-color": r ? "#38bdf8" : "#0284c7",
          "line-width": 1.6,
          "line-opacity": 0.7
        }
      },
      e
    ), this.map.addSource("ssr-fires", {
      type: "geojson",
      data: ((w = this.hazards) == null ? void 0 : w.fires) ?? et
    }), this.map.addLayer({
      id: "ssr-fires-glow",
      type: "circle",
      source: "ssr-fires",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frp_mw"], 10],
          2,
          7.5,
          40,
          13,
          150,
          21
        ],
        "circle-color": [
          "case",
          ["==", ["get", "kind"], "planned_burn"],
          "#f59e0b",
          "#f97316"
        ],
        "circle-opacity": 0.3,
        "circle-blur": 0.62
      }
    }), this.map.addLayer({
      id: "ssr-fires-core",
      type: "circle",
      source: "ssr-fires",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frp_mw"], 10],
          2,
          3.8,
          40,
          6.2,
          150,
          10
        ],
        "circle-color": [
          "case",
          ["==", ["get", "kind"], "planned_burn"],
          "#fbbf24",
          [
            "step",
            ["coalesce", ["get", "hours_ago"], 12],
            "#fef08a",
            3,
            "#fb923c",
            12,
            "#ef4444",
            24,
            "#b91c1c"
          ]
        ],
        "circle-stroke-color": "rgba(15, 23, 42, 0.92)",
        "circle-stroke-width": 1.25
      }
    }), this.map.addSource("ssr-lightning", {
      type: "geojson",
      data: et
    }), this.map.addLayer({
      id: "ssr-lightning-halo",
      type: "circle",
      source: "ssr-lightning",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          12,
          10,
          7,
          30,
          4
        ],
        "circle-color": "#fde047",
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          0.55,
          20,
          0.15,
          45,
          0
        ],
        "circle-blur": 0.6
      }
    }), this.map.addLayer({
      id: "ssr-lightning-bolt",
      type: "circle",
      source: "ssr-lightning",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "frame_age_min"], 10],
          0,
          4.8,
          15,
          3.4,
          45,
          2.2
        ],
        "circle-color": [
          "step",
          ["coalesce", ["get", "frame_age_min"], 10],
          "#ffffff",
          4,
          "#fde047",
          12,
          "#f97316",
          25,
          "#dc2626"
        ],
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1.2
      }
    });
  }
  updateHomeMarker(t, e) {
    if (!(!this.map || !this.ml))
      if (this.homeMarker)
        this.homeMarker.setLngLat([e, t]);
      else {
        const i = document.createElement("div");
        i.style.width = "14px", i.style.height = "14px", i.style.borderRadius = "9999px", i.style.background = "#0ea5e9", i.style.border = "2.5px solid #ffffff", i.style.boxShadow = "0 0 0 4px rgba(14, 165, 233, 0.30), 0 2px 6px rgba(15, 23, 42, 0.55)", i.title = "Home / Solar PV Array", this.homeMarker = new this.ml.Marker({ element: i }).setLngLat([e, t]).addTo(this.map);
      }
  }
  updateConfig(t) {
    var i;
    if (this.config = t, !this.map) return;
    const e = N(t.basemap_theme, this.getHass());
    this.applyStyleChange(t.basemap_theme ?? "auto"), this.syncLayerVisibilityAndOpacity(), (i = this.windRenderer) == null || i.setOptions(
      t.show_wind ?? !0,
      t.wind_level ?? "850hPa",
      t.wind_opacity ?? 0.85,
      e
    );
  }
  setManifest(t) {
    var i;
    const e = this.manifest === null;
    if (this.manifest = t, e && this.map && this.config.center_latitude === void 0 && this.map.jumpTo({
      center: [t.location.longitude, t.location.latitude],
      zoom: this.config.zoom_level ?? 7.2
    }), this.updateHomeMarker(
      this.config.center_latitude ?? t.location.latitude,
      this.config.center_longitude ?? t.location.longitude
    ), (this.config.basemap_theme === "bom_dark" || this.config.basemap_theme === "bom_light") && this.updateConfig(this.config), this.styleReady && this.map) {
      const r = t.bbox.coordinates, a = JSON.stringify(r);
      if (a !== this.appliedCoordsKey) {
        this.appliedCoordsKey = a;
        for (const n of ["ssr-true-colour", "ssr-visual-cloud", "ssr-radar"]) {
          const h = this.map.getSource(n);
          h == null || h.setCoordinates(r);
        }
      }
      const o = this.map.getSource("ssr-solar-arcs");
      o && ((i = t.solar) != null && i.arrival_arcs_geojson) && o.setData(t.solar.arrival_arcs_geojson);
    }
  }
  setWind(t) {
    var i, r;
    this.wind = t;
    const e = N(this.config.basemap_theme, this.getHass());
    (i = this.windRenderer) == null || i.setWindData(t), (r = this.windRenderer) == null || r.setOptions(
      this.config.show_wind ?? !0,
      this.config.wind_level ?? "850hPa",
      this.config.wind_opacity ?? 0.85,
      e
    );
  }
  setHazards(t) {
    if (this.hazards = t, !this.styleReady || !this.map) return;
    const e = this.map.getSource("ssr-fires");
    e == null || e.setData(t.fires ?? et), this.latestFrame && this.updateTimeFilteredLightning(this.latestFrame.slot.epoch);
  }
  applyFrame(t) {
    if (this.latestFrame = t, !this.styleReady || !this.map) return;
    const e = this.defaultCoords(), i = this.map.getSource("ssr-true-colour");
    i && (this.config.show_true_colour ?? !0) && t.trueColourBlobUrl && t.trueColourBlobUrl !== this.appliedUrls.tc && (this.appliedUrls.tc = t.trueColourBlobUrl, i.updateImage({ url: t.trueColourBlobUrl, coordinates: e }));
    const r = this.map.getSource("ssr-visual-cloud");
    r && (this.config.show_cloud_overlay ?? !1) && t.cloudOverlayBlobUrl && t.cloudOverlayBlobUrl !== this.appliedUrls.vc && (this.appliedUrls.vc = t.cloudOverlayBlobUrl, r.updateImage({ url: t.cloudOverlayBlobUrl, coordinates: e }));
    const a = this.map.getSource("ssr-radar");
    a && (this.config.show_radar ?? !0) && t.radarBlobUrl && t.radarBlobUrl !== this.appliedUrls.rad && (this.appliedUrls.rad = t.radarBlobUrl, a.updateImage({ url: t.radarBlobUrl, coordinates: e })), this.updateTimeFilteredLightning(t.slot.epoch);
  }
  updateTimeFilteredLightning(t) {
    var r;
    if (!this.map || !this.styleReady || !((r = this.hazards) != null && r.lightning)) return;
    const e = this.map.getSource("ssr-lightning");
    if (!e) return;
    if (!(this.config.show_lightning ?? !0)) {
      e.setData(et);
      return;
    }
    const i = this.hazards.lightning.features.filter((a) => {
      var h;
      const o = Number(((h = a.properties) == null ? void 0 : h.epoch) ?? 0), n = t - o;
      return n >= -120 && n <= 2100;
    }).map((a) => {
      var o;
      return {
        ...a,
        properties: {
          ...a.properties,
          frame_age_min: Math.max(
            0,
            Math.round((t - Number(((o = a.properties) == null ? void 0 : o.epoch) ?? t)) / 60 * 10) / 10
          )
        }
      };
    });
    e.setData({ type: "FeatureCollection", features: i });
  }
  syncLayerVisibilityAndOpacity() {
    var o, n;
    if (!this.map || !this.styleReady) return;
    const t = (h, c) => {
      var l;
      (l = this.map) != null && l.getLayer(h) && this.map.setLayoutProperty(h, "visibility", c ? "visible" : "none");
    }, e = (h, c) => {
      var l;
      (l = this.map) != null && l.getLayer(h) && this.map.setPaintProperty(h, "raster-opacity", Math.max(0, Math.min(1, c)));
    };
    t("ssr-true-colour-layer", this.config.show_true_colour ?? !0), e("ssr-true-colour-layer", this.config.true_colour_opacity ?? 1), t("ssr-visual-cloud-layer", this.config.show_cloud_overlay ?? !1), e("ssr-visual-cloud-layer", this.config.cloud_opacity ?? 0.58), t("ssr-radar-layer", this.config.show_radar ?? !0), e("ssr-radar-layer", this.config.radar_opacity ?? 0.84), this.latestFrame && this.applyFrame(this.latestFrame);
    const i = this.config.show_solar_rings ?? !0;
    t("ssr-solar-arcs-line", i), t("ssr-solar-vector-line", i);
    const r = this.config.show_fires ?? !0;
    t("ssr-fires-glow", r), t("ssr-fires-core", r), r || ((o = this.hoverPopup) == null || o.remove(), this.hoverPopup = null, (n = this.pinnedPopup) == null || n.remove(), this.pinnedPopup = null);
    const a = this.config.show_lightning ?? !0;
    t("ssr-lightning-halo", a), t("ssr-lightning-bolt", a);
  }
  syncAllState() {
    this.syncLayerVisibilityAndOpacity(), this.manifest && this.setManifest(this.manifest), this.wind && this.setWind(this.wind), this.hazards && this.setHazards(this.hazards), this.latestFrame && this.applyFrame(this.latestFrame);
  }
  recenter() {
    if (!this.map) return;
    const [t, e] = this.getHomeLatLon();
    this.map.flyTo({
      center: [e, t],
      zoom: this.config.zoom_level ?? 7.2,
      duration: 650
    });
  }
  zoomBy(t) {
    if (this.map)
      if (this.locked) {
        const [e, i] = this.getHomeLatLon();
        this.map.easeTo({
          center: [i, e],
          zoom: this.map.getZoom() + t,
          duration: 220
        });
      } else
        this.map.zoomTo(this.map.getZoom() + t, { duration: 220 });
  }
  destroy() {
    this.destroyed = !0, this.detachLifecycleListeners(), this.teardownMapOnly();
  }
}
var Ye = Object.defineProperty, _ = (s, t, e, i) => {
  for (var r = void 0, a = s.length - 1, o; a >= 0; a--)
    (o = s[a]) && (r = o(t, e, r) || r);
  return r && Ye(t, e, r), r;
};
const St = {
  type: "custom:solar-sky-radar-card",
  basemap_theme: "auto",
  zoom_level: 7.2,
  map_height: 490,
  lock_map: !0,
  show_true_colour: !0,
  true_colour_opacity: 1,
  show_cloud_overlay: !1,
  cloud_mode: "solar_cloud",
  cloud_opacity: 0.58,
  show_radar: !0,
  radar_opacity: 0.85,
  show_wind: !0,
  wind_level: "850hPa",
  wind_opacity: 0.85,
  show_lightning: !0,
  show_fires: !0,
  show_solar_rings: !0,
  show_solar_hud: !0,
  show_legend: !0,
  autoplay_mode: "off",
  autoplay: !1,
  playback_speed: 1
};
function B(s, t, e, i) {
  const r = typeof s == "number" ? s : Number(s);
  return Number.isFinite(r) ? Math.max(e, Math.min(i, r)) : t;
}
function Xe(s) {
  const t = { ...St, ...s };
  if (t.zoom_level = B(t.zoom_level, 7.2, 3, 12), t.map_height = B(t.map_height, 490, 240, 1400), t.true_colour_opacity = B(t.true_colour_opacity, 1, 0.05, 1), t.cloud_opacity = B(t.cloud_opacity, 0.58, 0.05, 1), t.radar_opacity = B(t.radar_opacity, 0.85, 0.05, 1), t.wind_opacity = B(t.wind_opacity, 0.85, 0.05, 1), t.playback_speed = B(t.playback_speed, 1, 0.25, 4), t.center_latitude !== void 0) {
    const e = Number(t.center_latitude);
    t.center_latitude = Number.isFinite(e) ? Math.max(-85, Math.min(85, e)) : void 0;
  }
  if (t.center_longitude !== void 0) {
    const e = Number(t.center_longitude);
    t.center_longitude = Number.isFinite(e) ? Math.max(-180, Math.min(180, e)) : void 0;
  }
  return t;
}
const Ft = class Ft extends D {
  constructor() {
    super(...arguments), this.preview = !1, this.editMode = !1, this.isPanel = !1, this.config = { ...St }, this.manifest = null, this.wind = null, this.hazards = null, this.timeline = [], this.readySlots = [], this.currentIndex = 0, this.playing = !1, this.speed = 1, this.loading = !0, this.errorMessage = null, this.mapEngineError = null, this.hudExpanded = !1, this.layersOpen = !1, this.attribOpen = !1, this.mapLocked = !0, this.mapController = null, this.framePlayer = null, this.pollTimer = null, this.disconnectTimer = null, this.visibilityObserver = null, this.isUncovered75 = !1, this.hasPlayedSingleOnReveal = !1, this.userPausedWhileVisible = !1, this.lastDarkResolved = null, this.toggleMapLock = () => {
      var e;
      const t = !this.mapLocked;
      this.mapLocked = t, (e = this.mapController) == null || e.setLocked(t, !0);
    };
  }
  static getConfigElement() {
    return document.createElement("solar-sky-radar-card-editor");
  }
  static getStubConfig() {
    return { ...St };
  }
  connectedCallback() {
    super.connectedCallback(), Ue(), this.hasPlayedSingleOnReveal = !1, this.userPausedWhileVisible = !1, this.disconnectTimer !== null && (globalThis.clearTimeout(this.disconnectTimer), this.disconnectTimer = null), this.mapController ? (this.mapController.handleReconnect(), this.ensurePollTimer(), this.ensureVisibilityObserver()) : this.hasUpdated && this.ensureRuntimeMounted();
  }
  updated(t) {
    var e;
    if (t.has("hass")) {
      const i = N(this.config.basemap_theme, this.hass);
      this.lastDarkResolved !== null && i !== this.lastDarkResolved && ((e = this.mapController) == null || e.updateConfig(this.config)), this.lastDarkResolved = i;
    }
  }
  setConfig(t) {
    var o, n, h, c, l, d;
    if (!t || typeof t != "object")
      throw new Error("Invalid configuration");
    const e = this.config.lock_map, i = pt(this.config);
    this.config = Xe(t);
    const r = this.config.lock_map ?? !0;
    (e !== t.lock_map || !this.mapController) && (this.mapLocked = r, (o = this.mapController) == null || o.setLocked(r, r));
    const a = pt(this.config);
    i !== a && (this.hasPlayedSingleOnReveal = !1, this.userPausedWhileVisible = !1), this.speed = this.config.playback_speed ?? 1, (n = this.mapController) == null || n.updateConfig(this.config), (h = this.framePlayer) == null || h.setEntryId(this.config.entry_id), (c = this.framePlayer) == null || c.setLayerFlags({
      trueColour: this.config.show_true_colour ?? !0,
      cloudOverlay: this.config.show_cloud_overlay ?? !1,
      cloudMode: this.config.cloud_mode ?? "solar_cloud",
      radar: this.config.show_radar ?? !0
    }), (l = this.framePlayer) == null || l.setSpeed(this.speed), a === "off" && this.playing ? (d = this.framePlayer) == null || d.pause() : this.maybeTriggerVisibilityPlayback();
  }
  getCardSize() {
    return Math.ceil(((this.config.map_height ?? 490) + 74) / 50);
  }
  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }
  firstUpdated() {
    this.isConnected && this.ensureRuntimeMounted();
  }
  ensurePollTimer() {
    this.pollTimer === null && (this.pollTimer = globalThis.setInterval(() => {
      this.refreshAllData(!1);
    }, 18e4));
  }
  ensureVisibilityObserver() {
    this.visibilityObserver || typeof IntersectionObserver > "u" || (this.visibilityObserver = new IntersectionObserver(
      (t) => {
        var o;
        const e = t[t.length - 1];
        if (!e) return;
        const i = window.innerHeight || document.documentElement.clientHeight || 800, r = Math.min(
          e.boundingClientRect.height * 0.75,
          i * 0.75
        ), a = e.isIntersecting && e.intersectionRect.height >= Math.max(1, r - 2);
        if (this.isUncovered75 = a, !e.isIntersecting || e.intersectionRatio < 0.1) {
          this.userPausedWhileVisible = !1, this.playing && ((o = this.framePlayer) == null || o.pause());
          return;
        }
        a && this.maybeTriggerVisibilityPlayback();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] }
    ), this.visibilityObserver.observe(this));
  }
  ensureRuntimeMounted() {
    if (!this.isConnected || this.mapController) return;
    const t = this.renderRoot.querySelector(".map-canvas");
    t && (this.mapEngineError = null, this.lastDarkResolved = N(this.config.basemap_theme, this.hass), this.mapController = new Je(
      t,
      () => this.hass,
      () => {
        this.layersOpen && (this.layersOpen = !1), this.attribOpen && (this.attribOpen = !1);
      },
      (e) => {
        this.mapEngineError = e;
      }
    ), this.mapController.init(this.config), this.mapController.setLocked(this.mapLocked, !1), this.manifest && this.mapController.setManifest(this.manifest), this.wind && this.mapController.setWind(this.wind), this.hazards && this.mapController.setHazards(this.hazards), this.framePlayer = new Fe(
      () => this.hass,
      (e) => {
        var i;
        this.currentIndex = e.index, (i = this.mapController) == null || i.applyFrame(e);
      },
      (e) => {
        this.readySlots = e;
      },
      (e) => {
        this.playing = e;
      }
    ), this.framePlayer.setEntryId(this.config.entry_id), this.framePlayer.setLayerFlags({
      trueColour: this.config.show_true_colour ?? !0,
      cloudOverlay: this.config.show_cloud_overlay ?? !1,
      cloudMode: this.config.cloud_mode ?? "solar_cloud",
      radar: this.config.show_radar ?? !0
    }), this.framePlayer.setSpeed(this.speed), this.refreshAllData(this.manifest === null), this.ensurePollTimer(), this.ensureVisibilityObserver());
  }
  teardownRuntime() {
    var t, e, i;
    this.pollTimer !== null && (globalThis.clearInterval(this.pollTimer), this.pollTimer = null), (t = this.visibilityObserver) == null || t.disconnect(), this.visibilityObserver = null, (e = this.framePlayer) == null || e.destroy(), this.framePlayer = null, (i = this.mapController) == null || i.destroy(), this.mapController = null, this.playing = !1;
  }
  maybeTriggerVisibilityPlayback() {
    var e, i;
    if (!this.isUncovered75 || this.loading || this.timeline.length <= 1)
      return;
    const t = pt(this.config);
    t === "once" ? !this.hasPlayedSingleOnReveal && !this.playing && (this.hasPlayedSingleOnReveal = !0, (e = this.framePlayer) == null || e.play(!0)) : t === "loop" && !this.playing && !this.userPausedWhileVisible && ((i = this.framePlayer) == null || i.play(!1));
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), this.pollTimer !== null && (globalThis.clearInterval(this.pollTimer), this.pollTimer = null), (t = this.visibilityObserver) == null || t.disconnect(), this.visibilityObserver = null, this.disconnectTimer !== null && globalThis.clearTimeout(this.disconnectTimer), this.disconnectTimer = globalThis.setTimeout(() => {
      this.disconnectTimer = null, this.isConnected || this.teardownRuntime();
    }, 120);
  }
  apiBase() {
    return (this.config.api_base ?? "/api/solar_sky_radar").replace(/\/$/, "");
  }
  async apiGetJson(t) {
    var i;
    const e = (i = this.hass) != null && i.fetchWithAuth && t.startsWith("/api/") ? await this.hass.fetchWithAuth(t) : await fetch(t, { credentials: "same-origin" });
    if (!e.ok)
      throw new Error(`HTTP ${e.status} loading ${t}`);
    return await e.json();
  }
  async refreshAllData(t = !1) {
    var r, a, o, n, h;
    t && (this.loading = !0), this.errorMessage = null;
    const e = this.config.entry_id ? `?entry_id=${encodeURIComponent(this.config.entry_id)}` : "", i = this.apiBase();
    try {
      const c = await this.apiGetJson(
        `${i}/manifest${e}`
      );
      this.manifest = c, this.timeline = c.timeline ?? [], (r = this.mapController) == null || r.setManifest(c), await ((a = this.framePlayer) == null ? void 0 : a.loadManifest(c, !t)), this.currentIndex = ((o = this.framePlayer) == null ? void 0 : o.index) ?? 0;
      const [l, d] = await Promise.allSettled([
        this.apiGetJson(`${c.endpoints.wind}${e}`),
        this.apiGetJson(`${c.endpoints.hazards}${e}`)
      ]);
      l.status === "fulfilled" && (this.wind = l.value, (n = this.mapController) == null || n.setWind(l.value)), d.status === "fulfilled" && (this.hazards = d.value, (h = this.mapController) == null || h.setHazards(d.value));
    } catch (c) {
      this.errorMessage = c instanceof Error ? c.message : "Failed to load Solar Sky Radar feed";
    } finally {
      this.loading = !1, t && this.maybeTriggerVisibilityPlayback();
    }
  }
  toggleFlag(t, e = !0) {
    const i = !!(this.config[t] ?? e);
    this.setConfig({ ...this.config, [t]: !i });
  }
  cycleCloudMode() {
    const t = (this.config.cloud_mode ?? "solar_cloud") === "cloud_mask" ? "solar_cloud" : "cloud_mask";
    this.setConfig({ ...this.config, show_cloud_overlay: !0, cloud_mode: t });
  }
  cycleWindLevel() {
    const t = (this.config.wind_level ?? "850hPa") === "850hPa" ? "10m" : "850hPa";
    this.setConfig({ ...this.config, show_wind: !0, wind_level: t });
  }
  activeLayerCount() {
    return [
      this.config.show_true_colour ?? !0,
      this.config.show_cloud_overlay ?? !1,
      this.config.show_radar ?? !0,
      this.config.show_wind ?? !0,
      this.config.show_lightning ?? !0,
      this.config.show_fires ?? !0,
      this.config.show_solar_rings ?? !0
    ].filter(Boolean).length;
  }
  renderSolarHud() {
    var i, r, a;
    if (!(this.config.show_solar_hud ?? !0)) return m;
    const t = (i = this.manifest) == null ? void 0 : i.solar, e = this.config.title ? `${this.config.title} · ` : "";
    return t ? v`
      <div
        class="solar-hud"
        title="Tap to toggle 60-minute upwind solar forecast"
        @click=${() => {
      this.hudExpanded = !this.hudExpanded;
    }}
      >
        <div class="hud-header">
          <span class="regime-dot regime-${t.regime}"></span>
          <span class="hud-title">${e}${t.regime_label}</span>
          <span class="hud-chevron">${this.hudExpanded ? "▴" : "▾"}</span>
        </div>
        <div class="hud-metrics">
          <span class="hud-metric">
            Solar <strong>~${t.estimated_transmittance_pct}%</strong>
          </span>
          <span class="hud-metric">
            Cloud <strong>${Math.round(t.local_cloud_cover_pct)}%</strong>
          </span>
          <span class="hud-metric">
            Patchiness <strong>${Math.round(t.patchiness_index)}</strong>/100
          </span>
          ${t.approaching_cloud_eta_min !== null ? v`<span class="hud-metric hud-eta">
                Drop ETA <strong>~${t.approaching_cloud_eta_min}m</strong>
              </span>` : m}
        </div>

        ${this.hudExpanded ? v`
              <div class="hud-expanded">
                <div>${t.summary}</div>
                <div class="hud-submeta">
                  850 hPa Cloud Steering: ${Math.round(t.cloud_wind_speed_kmh)} km/h
                  from ${Math.round(t.cloud_wind_from_deg)}° · Sat:
                  ${((r = this.manifest) == null ? void 0 : r.providers.satellite.label) ?? ""}
                </div>
                ${(a = t.forecast_60m) != null && a.length ? v`
                      <div class="forecast-strip">
                        ${t.forecast_60m.map(
      (o) => v`
                            <div class="fc-cell">
                              <div>+${o.minutes_ahead}m</div>
                              <div class="fc-bar-bg">
                                <div
                                  class="fc-bar-fill"
                                  style="width:${o.est_solar_pct}%;"
                                ></div>
                              </div>
                              <div>${o.est_solar_pct}%</div>
                            </div>
                          `
    )}
                      </div>
                    ` : m}
              </div>
            ` : m}
      </div>
    ` : v`
        <div class="solar-hud">
          <div class="hud-header">
            <span class="regime-dot regime-unknown"></span>
            <span class="hud-title">${e}Scanning Geostationary Sky...</span>
          </div>
        </div>
      `;
  }
  renderLegend() {
    var a, o, n, h, c, l;
    if (!(this.config.show_legend ?? !0)) return m;
    const t = (this.config.show_cloud_overlay ?? !1) && (this.config.cloud_mode ?? "solar_cloud") === "solar_cloud", e = ((n = (o = (a = this.hazards) == null ? void 0 : a.fires) == null ? void 0 : o.features) == null ? void 0 : n.length) ?? 0, i = ((l = (c = (h = this.hazards) == null ? void 0 : h.lightning) == null ? void 0 : c.meta) == null ? void 0 : l.count_2h) ?? 0, r = this.config.show_radar ?? !0;
    return !r && !t && e === 0 && i === 0 ? m : v`
      <div class="legend-strip">
        ${r ? v`
              <span class="legend-item">
                <span>Rain</span>
                <span class="radar-ramp"></span>
              </span>
            ` : m}
        ${t ? v`
              <span class="legend-item">
                <span class="swatch" style="background:#38d9ff;"></span>Cirrus
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#ffb418;"></span>Patchy
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#f96620;"></span>Thick
              </span>
              <span class="legend-item">
                <span class="swatch" style="background:#c444ff;"></span>Storm
              </span>
            ` : m}
        ${(this.config.show_fires ?? !0) && e > 0 ? v`
              <span class="legend-item">
                <span
                  class="swatch"
                  style="background:#fb923c;border-radius:50%;"
                ></span
                >Fires (${e})
              </span>
            ` : m}
        ${(this.config.show_lightning ?? !0) && i > 0 ? v`
              <span class="legend-item">
                <span
                  class="swatch"
                  style="background:#fde047;border-radius:50%;"
                ></span
                >Strikes (${i})
              </span>
            ` : m}
      </div>
    `;
  }
  renderAttribution() {
    const t = this.config.basemap_theme ?? "auto", e = t === "bom_dark" || t === "bom_light";
    return v`
      <div class="attrib-box">
        ${this.attribOpen ? v`
              <span class="attrib-links">
                ${e ? v`© Australian Bureau of Meteorology` : v`<a
                        href="https://openfreemap.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenFreeMap</a
                      >
                      · ©
                      <a
                        href="https://openmaptiles.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenMapTiles</a
                      >
                      · ©
                      <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noopener noreferrer"
                        >OpenStreetMap</a
                      >`}
              </span>
            ` : m}
        <button
          class="attrib-btn ${this.attribOpen ? "open" : ""}"
          type="button"
          title="Map & satellite data attribution"
          aria-label="Map attribution"
          @click=${() => {
      this.attribOpen = !this.attribOpen;
    }}
        >
          i
        </button>
      </div>
    `;
  }
  render() {
    var n, h;
    const t = this.config.map_height ?? 490, i = (this.config.cloud_mode ?? "solar_cloud") === "solar_cloud" ? "Mode: Solar Impact" : "Mode: Clean Mask", r = this.config.wind_level ?? "850hPa", a = N(this.config.basemap_theme, this.hass), o = this.activeLayerCount();
    return v`
      <div class="card" data-theme=${a ? "dark" : "light"}>
        <div
          class="viewport"
          data-locked=${this.mapLocked ? "true" : "false"}
          style="height: ${t}px;"
        >
          <div class="map-canvas"></div>

          ${this.renderSolarHud()}

          <div class="layer-dock">
            <button
              class="layers-pill ${this.layersOpen ? "open" : ""}"
              type="button"
              title="Show or hide map overlay controls"
              @click=${() => {
      this.layersOpen = !this.layersOpen;
    }}
            >
              <span>Layers</span>
              <span class="layers-count">${o}</span>
            </button>

            ${this.layersOpen ? v`
                  <div class="layers-popover">
                    <div class="popover-section-label">Active Overlays</div>
                    <div class="chip-group">
                      <button
                        class="chip ${this.config.show_true_colour ?? !0 ? "active" : ""}"
                        title="Toggle Himawari-9 / GeoColor Visible True Colour"
                        @click=${() => this.toggleFlag("show_true_colour", !0)}
                      >
                        True Colour
                      </button>
                      <button
                        class="chip ${this.config.show_cloud_overlay ?? !1 ? "active" : ""}"
                        title="Toggle Visual / Solar Cloud Overlay"
                        @click=${() => this.toggleFlag("show_cloud_overlay", !1)}
                      >
                        Clouds
                      </button>
                      ${this.config.show_cloud_overlay ?? !1 ? v`
                            <button
                              class="chip sub-mode"
                              title="Switch between Solar Cloud Classification and Clean Cloud Mask"
                              @click=${this.cycleCloudMode}
                            >
                              ${i}
                            </button>
                          ` : m}
                      <button
                        class="chip ${this.config.show_radar ?? !0 ? "active" : ""}"
                        title="Toggle Rain Radar"
                        @click=${() => this.toggleFlag("show_radar", !0)}
                      >
                        Rain
                      </button>
                      <button
                        class="chip ${this.config.show_wind ?? !0 ? "active" : ""}"
                        title="Toggle Curved Wind Streamlines"
                        @click=${() => this.toggleFlag("show_wind", !0)}
                      >
                        Wind
                      </button>
                      ${this.config.show_wind ?? !0 ? v`
                            <button
                              class="chip sub-mode"
                              title="Switch between 850 hPa Cloud-Steering Wind and 10 m Surface Wind"
                              @click=${this.cycleWindLevel}
                            >
                              ${r}
                            </button>
                          ` : m}
                      <button
                        class="chip ${this.config.show_lightning ?? !0 ? "active" : ""}"
                        title="Toggle Blitzortung Lightning"
                        @click=${() => this.toggleFlag("show_lightning", !0)}
                      >
                        Lightning
                      </button>
                      <button
                        class="chip ${this.config.show_fires ?? !0 ? "active" : ""}"
                        title="Toggle NASA FIRMS & DEA Bushfire Hotspots"
                        @click=${() => this.toggleFlag("show_fires", !0)}
                      >
                        FIRMS
                      </button>
                      <button
                        class="chip ${this.config.show_solar_rings ?? !0 ? "active" : ""}"
                        title="Toggle 15m (blue) / 30m (amber) / 60m (red) Upwind Cloud Arrival Arcs"
                        @click=${() => this.toggleFlag("show_solar_rings", !0)}
                      >
                        ETA Rings
                      </button>
                    </div>

                    <div class="mixer-group">
                      <div class="popover-section-label">Layer Opacity</div>
                      <div class="mixer-row">
                        <span
                          >True Colour
                          (${Math.round((this.config.true_colour_opacity ?? 1) * 100)}%)</span
                        >
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          .value=${String(this.config.true_colour_opacity ?? 1)}
                          @input=${(c) => this.setConfig({
      ...this.config,
      true_colour_opacity: Number(
        c.target.value
      )
    })}
                        />
                      </div>
                      <div class="mixer-row">
                        <span
                          >Cloud Overlay
                          (${Math.round((this.config.cloud_opacity ?? 0.58) * 100)}%)</span
                        >
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          .value=${String(this.config.cloud_opacity ?? 0.58)}
                          @input=${(c) => this.setConfig({
      ...this.config,
      cloud_opacity: Number(
        c.target.value
      )
    })}
                        />
                      </div>
                      <div class="mixer-row">
                        <span
                          >Rain Radar
                          (${Math.round((this.config.radar_opacity ?? 0.85) * 100)}%)</span
                        >
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          .value=${String(this.config.radar_opacity ?? 0.85)}
                          @input=${(c) => this.setConfig({
      ...this.config,
      radar_opacity: Number(
        c.target.value
      )
    })}
                        />
                      </div>
                    </div>
                  </div>
                ` : m}
          </div>

          ${this.renderLegend()}

          <div class="nav-stack">
            <button
              class="nav-btn"
              title="Zoom in"
              @click=${() => {
      var c;
      return (c = this.mapController) == null ? void 0 : c.zoomBy(1);
    }}
            >
              +
            </button>
            <button
              class="nav-btn"
              title="Zoom out"
              @click=${() => {
      var c;
      return (c = this.mapController) == null ? void 0 : c.zoomBy(-1);
    }}
            >
              &minus;
            </button>
            <button
              class="nav-btn lock-btn ${this.mapLocked ? "locked" : "unlocked"}"
              type="button"
              aria-pressed=${!this.mapLocked}
              title=${this.mapLocked ? "Map locked to centre (tap to unlock panning)" : "Panning unlocked (tap to recenter & lock)"}
              @click=${this.toggleMapLock}
            >
              ${this.mapLocked ? v`<svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5" y="11" width="14" height="10" rx="2.5"></rect>
                    <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                    <circle cx="12" cy="16" r="1.2" fill="currentColor"></circle>
                  </svg>` : v`<svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="7"></circle>
                    <circle cx="12" cy="12" r="2" fill="currentColor"></circle>
                    <line x1="12" y1="2" x2="12" y2="5"></line>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                    <line x1="2" y1="12" x2="5" y2="12"></line>
                    <line x1="19" y1="12" x2="22" y2="12"></line>
                  </svg>`}
            </button>
          </div>

          ${this.renderAttribution()}

          ${this.loading ? v`<div class="status-banner">
                Loading 2-hour Himawari / Radar frames...
              </div>` : m}
          ${this.errorMessage || this.mapEngineError ? v`<div class="status-banner status-error">
                ${this.errorMessage ?? this.mapEngineError}
              </div>` : m}
        </div>

        <solar-sky-jog-slider
          .timeline=${this.timeline}
          .readySlots=${this.readySlots}
          .currentIndex=${this.currentIndex}
          .playing=${this.playing}
          .speed=${this.speed}
          .dark=${a}
          .timeZone=${((h = (n = this.hass) == null ? void 0 : n.config) == null ? void 0 : h.time_zone) ?? ""}
          @jog-seek=${(c) => {
      var l, d;
      c.detail.pause && (this.userPausedWhileVisible = !0), (l = this.framePlayer) == null || l.seek(c.detail.index, c.detail.pause), this.playing = ((d = this.framePlayer) == null ? void 0 : d.isPlaying) ?? !1;
    }}
          @jog-step=${(c) => {
      var l;
      this.userPausedWhileVisible = !0, (l = this.framePlayer) == null || l.step(c.detail.delta), this.playing = !1;
    }}
          @jog-toggle=${() => {
      var l;
      const c = ((l = this.framePlayer) == null ? void 0 : l.togglePlay()) ?? !1;
      this.playing = c, this.userPausedWhileVisible = !c;
    }}
          @jog-speed=${(c) => {
      var l;
      this.speed = c.detail.speed, (l = this.framePlayer) == null || l.setSpeed(this.speed);
    }}
        ></solar-sky-jog-slider>
      </div>
    `;
  }
};
Ft.styles = [
  se(Re),
  At`
      :host {
        display: block;
      }

      .card {
        --surface-bg: rgba(15, 23, 42, 0.86);
        --surface-bg-hover: rgba(15, 23, 42, 0.95);
        --surface-elevated: rgba(30, 41, 59, 0.9);
        --surface-border: rgba(148, 163, 184, 0.28);
        --text-strong: #f8fafc;
        --text-body: #cbd5e1;
        --text-muted: #94a3b8;
        --eta-accent: #fbbf24;
        --subchip-bg: rgba(245, 158, 11, 0.2);
        --subchip-border: rgba(251, 191, 36, 0.6);
        --subchip-text: #fde68a;

        background: #0b1120;
        border-radius: var(--ha-card-border-radius, 14px);
        overflow: hidden;
        border: 1px solid var(--divider-color, rgba(148, 163, 184, 0.2));
        box-shadow: var(--ha-card-box-shadow, 0 6px 24px rgba(0, 0, 0, 0.22));
        position: relative;
        font-family: var(
          --paper-font-body1_-_font-family,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Roboto,
          sans-serif
        );
        color: var(--text-strong);
      }

      .card[data-theme="light"] {
        --surface-bg: rgba(255, 255, 255, 0.9);
        --surface-bg-hover: rgba(255, 255, 255, 0.98);
        --surface-elevated: rgba(241, 245, 249, 0.95);
        --surface-border: rgba(15, 23, 42, 0.16);
        --text-strong: #0f172a;
        --text-body: #334155;
        --text-muted: #64748b;
        --eta-accent: #b45309;
        --subchip-bg: rgba(254, 243, 199, 0.95);
        --subchip-border: rgba(217, 119, 6, 0.5);
        --subchip-text: #92400e;
        background: #e2e8f0;
      }

      .viewport {
        position: relative;
        width: 100%;
      }

      .map-canvas {
        position: absolute;
        inset: 0;
      }

      /* When locked to centre, pass single-finger vertical swipes straight through to mobile page scroll */
      .viewport[data-locked="true"] .map-canvas,
      .viewport[data-locked="true"] .maplibregl-map,
      .viewport[data-locked="true"] .maplibregl-canvas-container,
      .viewport[data-locked="true"] .maplibregl-canvas {
        touch-action: pan-y !important;
      }

      .viewport[data-locked="true"] .maplibregl-canvas-container {
        cursor: default;
      }

      /* Top-left Solar HUD — never collides with the single top-right Layers pill */
      .solar-hud {
        position: absolute;
        top: 10px;
        left: 10px;
        max-width: min(350px, calc(100% - 118px));
        z-index: 6;
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 7px 11px;
        cursor: pointer;
        user-select: none;
        transition: border-color 0.15s ease, background 0.15s ease;
        box-shadow: 0 3px 12px rgba(15, 23, 42, 0.18);
      }

      .solar-hud:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      .hud-header {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .regime-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .regime-clear_reliable {
        background: #16a34a;
        box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
      }
      .regime-mostly_clear {
        background: #65a30d;
      }
      .regime-thin_high_cirrus {
        background: #0284c7;
      }
      .regime-patchy_unreliable {
        background: #f59e0b;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
      }
      .regime-overcast_steady {
        background: #64748b;
      }
      .regime-storm_approaching {
        background: #c026d3;
        box-shadow: 0 0 8px rgba(192, 38, 211, 0.65);
      }
      .regime-unknown {
        background: #94a3b8;
      }

      .hud-title {
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        color: var(--text-strong);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .hud-chevron {
        font-size: 10px;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .hud-metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 3px;
        font-size: 11px;
        color: var(--text-body);
        font-variant-numeric: tabular-nums;
      }

      .hud-metric strong {
        color: var(--text-strong);
      }

      .hud-eta {
        color: var(--eta-accent);
        font-weight: 600;
      }

      .hud-expanded {
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid var(--surface-border);
        font-size: 11.5px;
        color: var(--text-body);
        line-height: 1.4;
      }

      .hud-submeta {
        margin-top: 4px;
        font-size: 10.5px;
        color: var(--text-muted);
      }

      .forecast-strip {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 4px;
        margin-top: 7px;
      }

      .fc-cell {
        background: var(--surface-elevated);
        border: 1px solid var(--surface-border);
        border-radius: 6px;
        padding: 4px 3px;
        text-align: center;
        font-size: 10px;
        color: var(--text-strong);
        font-variant-numeric: tabular-nums;
      }

      .fc-bar-bg {
        height: 4px;
        border-radius: 2px;
        background: rgba(148, 163, 184, 0.32);
        margin: 3px 2px;
        overflow: hidden;
      }

      .fc-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #f59e0b, #0ea5e9);
      }

      /* Top-right single Layers pill + collapsible popover */
      .layer-dock {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 7;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }

      button.layers-pill {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--text-strong);
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.18);
        transition: all 0.14s ease;
      }

      button.layers-pill:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      button.layers-pill.open {
        background: rgba(2, 132, 199, 0.92);
        border-color: #0284c7;
        color: #ffffff;
      }

      .layers-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 17px;
        height: 17px;
        padding: 0 5px;
        border-radius: 999px;
        font-size: 10.5px;
        font-weight: 700;
        background: rgba(14, 165, 233, 0.22);
        color: var(--text-strong);
        font-variant-numeric: tabular-nums;
      }

      button.layers-pill.open .layers-count {
        background: rgba(255, 255, 255, 0.24);
        color: #ffffff;
      }

      .layers-popover {
        width: min(268px, calc(100vw - 24px));
        background: var(--surface-bg-hover);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 10px 11px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.28);
        display: flex;
        flex-direction: column;
        gap: 9px;
      }

      .popover-section-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .chip-group {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      button.chip {
        appearance: none;
        border: 1px solid var(--surface-border);
        background: var(--surface-elevated);
        color: var(--text-body);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.14s ease;
        white-space: nowrap;
      }

      button.chip:hover {
        border-color: #0284c7;
        color: var(--text-strong);
      }

      button.chip.active {
        background: rgba(2, 132, 199, 0.9);
        border-color: #0284c7;
        color: #ffffff;
      }

      button.chip.sub-mode {
        background: var(--subchip-bg);
        border-color: var(--subchip-border);
        color: var(--subchip-text);
      }

      .mixer-group {
        border-top: 1px solid var(--surface-border);
        padding-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .mixer-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
        color: var(--text-body);
      }

      .mixer-row input[type="range"] {
        width: 100%;
        accent-color: #0284c7;
        height: 4px;
        cursor: pointer;
      }

      /* Bottom-left Legend Strip — stays flush at bottom without being bumped up */
      .legend-strip {
        position: absolute;
        left: 10px;
        bottom: 10px;
        max-width: calc(100% - 54px);
        z-index: 5;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
        background: var(--surface-bg);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid var(--surface-border);
        border-radius: 9px;
        padding: 4px 8px;
        font-size: 10.5px;
        color: var(--text-body);
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .swatch {
        width: 9px;
        height: 9px;
        border-radius: 2px;
      }

      .radar-ramp {
        width: 38px;
        height: 7px;
        border-radius: 3px;
        background: linear-gradient(
          90deg,
          #38bdf8 0%,
          #22c55e 34%,
          #facc15 62%,
          #ef4444 84%,
          #c084fc 100%
        );
      }

      /* Bottom-right compact Zoom/Recenter stack + minimal collapsed-by-default attribution */
      .nav-stack {
        position: absolute;
        right: 8px;
        bottom: 34px;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      button.nav-btn {
        appearance: none;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: var(--text-strong);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
      }

      button.nav-btn:hover {
        border-color: #0284c7;
        background: var(--surface-bg-hover);
      }

      button.nav-btn.lock-btn {
        transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease,
          box-shadow 0.16s ease;
      }

      button.nav-btn.lock-btn.unlocked {
        border-color: #38bdf8;
        background: rgba(14, 165, 233, 0.24);
        color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.22),
          0 2px 8px rgba(15, 23, 42, 0.18);
      }

      .card[data-theme="light"] button.nav-btn.lock-btn.unlocked {
        border-color: #0284c7;
        background: rgba(2, 132, 199, 0.16);
        color: #0284c7;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.18),
          0 2px 8px rgba(15, 23, 42, 0.12);
      }

      .attrib-box {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 6;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .attrib-links {
        background: var(--surface-bg-hover);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid var(--surface-border);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.14);
      }

      .attrib-links a {
        color: var(--text-body);
        text-decoration: none;
      }

      .attrib-links a:hover {
        text-decoration: underline;
      }

      button.attrib-btn {
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 1px solid var(--surface-border);
        background: var(--surface-bg);
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 700;
        font-style: italic;
        font-family: Georgia, serif;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.72;
        transition: opacity 0.14s ease, border-color 0.14s ease;
      }

      button.attrib-btn:hover,
      button.attrib-btn.open {
        opacity: 1;
        border-color: #0284c7;
        color: var(--text-strong);
      }

      /* Loading & Error Banners */
      .status-banner {
        position: absolute;
        left: 50%;
        top: 56px;
        transform: translateX(-50%);
        z-index: 7;
        background: var(--surface-bg-hover);
        border: 1px solid #0284c7;
        border-radius: 999px;
        padding: 5px 13px;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text-strong);
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
      }

      .status-error {
        border-color: #ef4444;
        color: #dc2626;
      }

      .card[data-theme="dark"] .status-error {
        color: #fecaca;
      }

      @media (max-width: 520px) {
        .solar-hud {
          max-width: calc(100% - 108px);
          padding: 6px 9px;
        }
        .hud-metrics {
          gap: 5px;
          font-size: 10.5px;
        }
      }

      /* Fire Hotspot & Bushfire Incident Hover / Click Popups */
      .ssr-map-popup .maplibregl-popup-content {
        background: var(--surface-bg-hover);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--surface-border);
        border-radius: 10px;
        padding: 10px 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
        color: var(--text-strong);
        font-family: inherit;
        pointer-events: none;
      }

      .ssr-map-popup-pinned .maplibregl-popup-content {
        pointer-events: auto;
        padding-right: 24px;
      }

      .ssr-map-popup .maplibregl-popup-close-button {
        color: var(--text-muted);
        font-size: 16px;
        padding: 4px 7px;
        line-height: 1;
      }

      .ssr-map-popup .maplibregl-popup-close-button:hover {
        color: var(--text-strong);
        background: transparent;
      }

      .ssr-map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
        border-top-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
        border-bottom-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
        border-right-color: var(--surface-bg-hover);
      }
      .ssr-map-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
        border-left-color: var(--surface-bg-hover);
      }

      .ssr-fire-tooltip {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 215px;
      }

      .ssr-fire-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }

      .ssr-fire-title {
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.3;
        color: var(--text-strong);
      }

      .ssr-fire-badge {
        flex-shrink: 0;
        padding: 2px 6px;
        border-radius: 9999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .ssr-fire-badge-emergency {
        background: rgba(220, 38, 38, 0.24);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.55);
      }
      .card[data-theme="light"] .ssr-fire-badge-emergency {
        background: rgba(220, 38, 38, 0.14);
        color: #b91c1c;
      }

      .ssr-fire-badge-watch,
      .ssr-fire-badge-bushfire {
        background: rgba(249, 115, 22, 0.22);
        color: #fdba74;
        border: 1px solid rgba(249, 115, 22, 0.48);
      }
      .card[data-theme="light"] .ssr-fire-badge-watch,
      .card[data-theme="light"] .ssr-fire-badge-bushfire {
        background: rgba(234, 88, 12, 0.14);
        color: #c2410c;
      }

      .ssr-fire-badge-burn,
      .ssr-fire-badge-advice {
        background: rgba(245, 158, 11, 0.20);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.45);
      }
      .card[data-theme="light"] .ssr-fire-badge-burn,
      .card[data-theme="light"] .ssr-fire-badge-advice {
        background: rgba(217, 119, 6, 0.14);
        color: #92400e;
      }

      .ssr-fire-badge-hotspot {
        background: rgba(251, 146, 60, 0.18);
        color: #fed7aa;
        border: 1px solid rgba(251, 146, 60, 0.38);
      }
      .card[data-theme="light"] .ssr-fire-badge-hotspot {
        background: rgba(234, 88, 12, 0.12);
        color: #9a3412;
      }

      .ssr-fire-sub {
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--surface-border);
      }
      .card[data-theme="light"] .ssr-fire-sub {
        color: #0284c7;
      }

      .ssr-fire-grid {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .ssr-fire-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        font-size: 11.2px;
        line-height: 1.35;
      }

      .ssr-fire-k {
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .ssr-fire-v {
        color: var(--text-strong);
        font-weight: 600;
        text-align: right;
      }

      .ssr-fire-hint {
        margin-top: 2px;
        font-size: 10px;
        color: var(--text-muted);
        text-align: right;
      }

      .ssr-fire-link {
        margin-top: 3px;
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        color: #38bdf8;
        text-decoration: none;
      }
      .card[data-theme="light"] .ssr-fire-link {
        color: #0284c7;
      }

      .ssr-fire-link:hover {
        text-decoration: underline;
      }
    `
];
let y = Ft;
_([
  M({ attribute: !1 })
], y.prototype, "hass");
_([
  M({ attribute: !1 })
], y.prototype, "layout");
_([
  M({ type: Boolean })
], y.prototype, "preview");
_([
  M({ type: Boolean })
], y.prototype, "editMode");
_([
  M({ type: Boolean })
], y.prototype, "isPanel");
_([
  $()
], y.prototype, "config");
_([
  $()
], y.prototype, "manifest");
_([
  $()
], y.prototype, "wind");
_([
  $()
], y.prototype, "hazards");
_([
  $()
], y.prototype, "timeline");
_([
  $()
], y.prototype, "readySlots");
_([
  $()
], y.prototype, "currentIndex");
_([
  $()
], y.prototype, "playing");
_([
  $()
], y.prototype, "speed");
_([
  $()
], y.prototype, "loading");
_([
  $()
], y.prototype, "errorMessage");
_([
  $()
], y.prototype, "mapEngineError");
_([
  $()
], y.prototype, "hudExpanded");
_([
  $()
], y.prototype, "layersOpen");
_([
  $()
], y.prototype, "attribOpen");
_([
  $()
], y.prototype, "mapLocked");
Lt("solar-sky-radar-card", y);
window.customCards = window.customCards || [];
window.customCards.some((s) => s.type === "solar-sky-radar-card") || window.customCards.push({
  type: "solar-sky-radar-card",
  name: "Solar Sky Radar",
  description: "Geostationary visible true-colour & solar cloud overlay with rain radar, 850hPa/10m wind streamlines, lightning, NASA FIRMS fires, and 2-hour jogging playback.",
  preview: !0,
  documentationURL: "https://github.com/lossanarch/solar-sky-radar"
});
export {
  y as SolarSkyRadarCard,
  lt as SolarSkyRadarCardEditor
};
