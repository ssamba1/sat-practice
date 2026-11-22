import {
  A,
  T,
  w
} from "./chunk-SYECWVCB.js";
import {
  $,
  k,
  n,
  r,
  x
} from "./chunk-RZBBS6KD.js";

// node_modules/@preact/signals-core/dist/signals-core.module.js
var i = Symbol.for("preact-signals");
function t() {
  if (!(v > 1)) {
    var i2, t2 = false;
    !function() {
      var i3 = c;
      c = void 0;
      while (void 0 !== i3) {
        var t3 = i3.S;
        if (t3.v === i3.v) {
          for (var r4 = t3.t; void 0 !== r4; r4 = r4.x) if (r4.i === i3.i) r4.i = t3.i;
        }
        i3 = i3.o;
      }
    }();
    while (void 0 !== h) {
      var r3 = h;
      h = void 0;
      s++;
      while (void 0 !== r3) {
        var n3 = r3.u;
        r3.u = void 0;
        r3.f &= -3;
        if (!(8 & r3.f) && w2(r3)) try {
          r3.c();
        } catch (r4) {
          if (!t2) {
            i2 = r4;
            t2 = true;
          }
        }
        r3 = n3;
      }
    }
    s = 0;
    v--;
    if (t2) throw i2;
  } else v--;
}
function r2(i2) {
  if (v > 0) return i2();
  u = ++e;
  v++;
  try {
    return i2();
  } finally {
    t();
  }
}
var n2;
var o = void 0;
function f(i2) {
  var t2 = o, r3 = n2;
  o = void 0;
  n2 = void 0;
  try {
    return i2();
  } finally {
    o = t2;
    n2 = r3;
  }
}
var h = void 0;
var v = 0;
var s = 0;
var e = 0;
var u = 0;
var c = void 0;
var a = 0;
function d(i2) {
  if (void 0 !== o) {
    var t2 = i2.n;
    if (void 0 === t2 || t2.t !== o) {
      t2 = { i: 0, S: i2, p: o.s, n: void 0, t: o, e: void 0, x: void 0, r: t2 };
      if (void 0 !== o.s) o.s.n = t2;
      o.s = t2;
      i2.n = t2;
      if (32 & o.f) i2.S(t2);
      return t2;
    } else if (-1 === t2.i) {
      t2.i = 0;
      if (void 0 !== t2.n) {
        t2.n.p = t2.p;
        if (void 0 !== t2.p) t2.p.n = t2.n;
        t2.p = o.s;
        t2.n = void 0;
        o.s.n = t2;
        o.s = t2;
      }
      return t2;
    }
  }
}
function l(i2, t2) {
  this.v = i2;
  this.i = 0;
  this.n = void 0;
  this.t = void 0;
  this.l = 0;
  this.W = null == t2 ? void 0 : t2.watched;
  this.Z = null == t2 ? void 0 : t2.unwatched;
  this.name = null == t2 ? void 0 : t2.name;
}
l.prototype.brand = i;
l.prototype.h = function() {
  return true;
};
l.prototype.S = function(i2) {
  var t2 = this, r3 = this.t;
  if (r3 !== i2 && void 0 === i2.e) {
    i2.x = r3;
    this.t = i2;
    if (void 0 !== r3) r3.e = i2;
    else f(function() {
      var i3;
      null == (i3 = t2.W) || i3.call(t2);
    });
  }
};
l.prototype.U = function(i2) {
  var t2 = this;
  if (void 0 !== this.t) {
    var r3 = i2.e, n3 = i2.x;
    if (void 0 !== r3) {
      r3.x = n3;
      i2.e = void 0;
    }
    if (void 0 !== n3) {
      n3.e = r3;
      i2.x = void 0;
    }
    if (i2 === this.t) {
      this.t = n3;
      if (void 0 === n3) f(function() {
        var i3;
        null == (i3 = t2.Z) || i3.call(t2);
      });
    }
  }
};
l.prototype.subscribe = function(i2) {
  var t2 = this;
  return x2(function() {
    var r3 = t2.value;
    f(function() {
      return i2(r3);
    });
  }, { name: "sub" });
};
l.prototype.valueOf = function() {
  return this.value;
};
l.prototype.toString = function() {
  return this.value + "";
};
l.prototype.toJSON = function() {
  return this.value;
};
l.prototype.peek = function() {
  var i2 = this;
  return f(function() {
    return i2.value;
  });
};
Object.defineProperty(l.prototype, "value", { get: function() {
  var i2 = d(this);
  if (void 0 !== i2) i2.i = this.i;
  return this.v;
}, set: function(i2) {
  if (i2 !== this.v) {
    if (s > 100) throw new Error("Cycle detected");
    !function(i3) {
      if (0 !== v && 0 === s) {
        if (i3.l !== u) {
          i3.l = u;
          c = { S: i3, v: i3.v, i: i3.i, o: c };
        }
      }
    }(this);
    this.v = i2;
    this.i++;
    a++;
    v++;
    try {
      for (var r3 = this.t; void 0 !== r3; r3 = r3.x) r3.t.N();
    } finally {
      t();
    }
  }
} });
function y(i2, t2) {
  return new l(i2, t2);
}
function w2(i2) {
  for (var t2 = i2.s; void 0 !== t2; t2 = t2.n) if (t2.S.i !== t2.i || !t2.S.h() || t2.S.i !== t2.i) return true;
  return false;
}
function b(i2) {
  for (var t2 = i2.s; void 0 !== t2; t2 = t2.n) {
    var r3 = t2.S.n;
    if (void 0 !== r3) t2.r = r3;
    t2.S.n = t2;
    t2.i = -1;
    if (void 0 === t2.n) {
      i2.s = t2;
      break;
    }
  }
}
function _(i2) {
  var t2 = i2.s, r3 = void 0;
  while (void 0 !== t2) {
    var n3 = t2.p;
    if (-1 === t2.i) {
      t2.S.U(t2);
      if (void 0 !== n3) n3.n = t2.n;
      if (void 0 !== t2.n) t2.n.p = n3;
    } else r3 = t2;
    t2.S.n = t2.r;
    if (void 0 !== t2.r) t2.r = void 0;
    t2 = n3;
  }
  i2.s = r3;
}
function j(i2, t2) {
  l.call(this, void 0, t2);
  this.x = i2;
  this.s = void 0;
  this.g = a - 1;
  this.f = 4;
}
j.prototype = new l();
j.prototype.h = function() {
  this.f &= -3;
  if (1 & this.f) return false;
  if (32 == (36 & this.f)) return true;
  this.f &= -5;
  if (this.g === a) return true;
  this.g = a;
  this.f |= 1;
  if (this.i > 0 && !w2(this)) {
    this.f &= -2;
    return true;
  }
  var i2 = o;
  try {
    b(this);
    o = this;
    var t2 = this.x();
    if (16 & this.f || this.v !== t2 || 0 === this.i) {
      this.v = t2;
      this.f &= -17;
      this.i++;
    }
  } catch (i3) {
    this.v = i3;
    this.f |= 16;
    this.i++;
  }
  o = i2;
  _(this);
  this.f &= -2;
  return true;
};
j.prototype.S = function(i2) {
  if (void 0 === this.t) {
    this.f |= 36;
    for (var t2 = this.s; void 0 !== t2; t2 = t2.n) t2.S.S(t2);
  }
  l.prototype.S.call(this, i2);
};
j.prototype.U = function(i2) {
  if (void 0 !== this.t) {
    l.prototype.U.call(this, i2);
    if (void 0 === this.t) {
      this.f &= -33;
      for (var t2 = this.s; void 0 !== t2; t2 = t2.n) t2.S.U(t2);
    }
  }
};
j.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (var i2 = this.t; void 0 !== i2; i2 = i2.x) i2.t.N();
  }
};
Object.defineProperty(j.prototype, "value", { get: function() {
  if (1 & this.f) throw new Error("Cycle detected");
  var i2 = d(this);
  this.h();
  if (void 0 !== i2) i2.i = this.i;
  if (16 & this.f) throw this.v;
  return this.v;
} });
function O(i2, t2) {
  return new j(i2, t2);
}
function p(i2) {
  var r3 = i2.j;
  i2.j = void 0;
  if ("function" == typeof r3) {
    v++;
    var n3 = o;
    o = void 0;
    try {
      r3();
    } catch (t2) {
      i2.f &= -2;
      i2.f |= 8;
      g(i2);
      throw t2;
    } finally {
      o = n3;
      t();
    }
  }
}
function g(i2) {
  for (var t2 = i2.s; void 0 !== t2; t2 = t2.n) t2.S.U(t2);
  i2.x = void 0;
  i2.s = void 0;
  p(i2);
}
function S(i2) {
  if (o !== this) throw new Error("Out-of-order effect");
  _(this);
  o = i2;
  this.f &= -2;
  try {
    if (8 & this.f) g(this);
  } finally {
    t();
  }
}
function m(i2, t2) {
  this.x = i2;
  this.j = void 0;
  this.s = void 0;
  this.u = void 0;
  this.f = 32;
  this.name = null == t2 ? void 0 : t2.name;
  if (n2) n2.push(this);
}
m.prototype.c = function() {
  var i2 = this.S();
  try {
    if (8 & this.f) return;
    if (void 0 === this.x) return;
    var t2 = this.x();
    if ("function" == typeof t2) this.j = t2;
  } finally {
    i2();
  }
};
m.prototype.S = function() {
  if (1 & this.f) throw new Error("Cycle detected");
  this.f |= 1;
  this.f &= -9;
  p(this);
  b(this);
  v++;
  var i2 = o;
  o = this;
  return S.bind(this, i2);
};
m.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 2;
    this.u = h;
    h = this;
  }
};
m.prototype.d = function() {
  this.f |= 8;
  if (!(1 & this.f)) g(this);
};
m.prototype.dispose = function() {
  this.d();
};
function x2(i2, t2) {
  var r3 = new m(i2, t2);
  try {
    r3.c();
  } catch (i3) {
    r3.d();
    throw i3;
  }
  var n3 = r3.d.bind(r3);
  n3[Symbol.dispose] = n3;
  return n3;
}
function E(i2) {
  return function() {
    var t2 = arguments, n3 = this;
    return r2(function() {
      return f(function() {
        return i2.apply(n3, [].slice.call(t2));
      });
    });
  };
}
function C() {
  var i2 = n2;
  n2 = [];
  return function() {
    var t2 = n2;
    if (n2 && i2) i2 = i2.concat(n2);
    n2 = i2;
    return t2;
  };
}
var k2 = function(i2, t2) {
  t2.push(i2);
  for (var r3 = "[object Object]" === Object.prototype.toString.call(i2), n3 = /* @__PURE__ */ Object.create(null), o2 = i2; o2 && o2 !== Object.prototype; o2 = r3 && Object.getPrototypeOf(o2)) {
    var f2 = Object.getOwnPropertyDescriptors(o2);
    for (var h3 in f2) if (!n3[h3]) {
      n3[h3] = true;
      var v2 = f2[h3].value;
      if ("function" == typeof v2) {
        if ("constructor" !== h3) i2[h3] = E(v2);
      } else if (o2 === i2 && "object" == typeof v2 && null !== v2 && !("brand" in v2) && t2.indexOf(v2) < 0) k2(v2, t2);
    }
  }
};
function T2(i2) {
  return function() {
    var t2, o2, f2 = C();
    try {
      o2 = i2.apply(void 0, [].slice.call(arguments));
    } catch (i3) {
      var h3 = n2;
      n2 = void 0;
      if (h3) try {
        r2(function() {
          for (var i4 = 0; i4 < h3.length; i4++) try {
            h3[i4].dispose();
          } catch (i5) {
          }
        });
      } catch (i4) {
      }
      throw i3;
    } finally {
      t2 = f2();
    }
    k2(o2, []);
    o2[Symbol.dispose] = E(function() {
      if (t2) for (var i3 = 0; i3 < t2.length; i3++) t2[i3].dispose();
      t2 = void 0;
    });
    return o2;
  };
}

// node_modules/@preact/signals/dist/signals.module.js
var h2;
var d2;
var p2;
var m2 = "undefined" != typeof window && !!window.__PREACT_SIGNALS_DEVTOOLS__;
var _2 = [];
var g2 = [];
x2(function() {
  h2 = this.N;
})();
function b2(i2, n3) {
  n[i2] = n3.bind(null, n[i2] || function() {
  });
}
function y2(i2) {
  if (p2) {
    var n3 = p2;
    p2 = void 0;
    n3();
  }
  p2 = i2 && i2.S();
}
function w3(i2) {
  var n3 = this, r3 = i2.data, t2 = useSignal(r3);
  t2.name = "ReactiveDom";
  t2.value = r3;
  var e2 = w(function() {
    var i3 = n3, r4 = n3.__v;
    while (r4 = r4.__) if (r4.__c) {
      r4.__c.__$f |= 4;
      break;
    }
    var o2 = O(function() {
      var i4 = t2.value.value;
      return 0 === i4 ? 0 : true === i4 ? "" : i4 || "";
    }), e3 = O(function() {
      return !Array.isArray(o2.value) && !r(o2.value);
    }), u3 = x2(function() {
      this.N = M;
      if (e3.value) {
        var n4 = o2.value;
        if (i3.__v && i3.__v.__e && 3 === i3.__v.__e.nodeType) i3.__v.__e.data = n4;
      }
    }), c3 = n3.__$u.d;
    n3.__$u.d = function() {
      u3();
      c3.call(this);
    };
    return [e3, o2];
  }, []), u2 = e2[0], c2 = e2[1];
  return u2.value ? c2.peek() : c2.value;
}
w3.displayName = "ReactiveTextNode";
Object.defineProperties(l.prototype, { constructor: { configurable: true, value: k($, null).constructor }, type: { configurable: true, value: w3 }, props: { configurable: true, get: function() {
  var i2 = this;
  return { data: { get value() {
    return i2.value;
  } } };
} }, __b: { configurable: true, value: 1 } });
b2("__b", function(i2, n3) {
  y2();
  d2 = void 0;
  if ("string" == typeof n3.type) {
    var r3, t2 = n3.props;
    for (var f2 in t2) if ("children" !== f2) {
      var o2 = t2[f2];
      if (o2 instanceof l) {
        if (!r3) n3.__np = r3 = {};
        r3[f2] = o2;
        t2[f2] = o2.peek();
      }
    }
  }
  i2(n3);
});
b2("__r", function(i2, r3) {
  i2(r3);
  if (r3.type !== $) {
    y2();
    var t2, f2 = r3.__c;
    if (f2) {
      f2.__$f &= -2;
      if (void 0 === (t2 = f2.__$u)) f2.__$u = t2 = function(i3, n3) {
        var r4;
        x2(function() {
          r4 = this;
        }, { name: n3 });
        r4.c = i3;
        return r4;
      }(/* @__PURE__ */ function(i3) {
        return function() {
          var n3;
          if (m2) null == (n3 = this.y) || n3.call(this);
          i3.__$f |= 1;
          i3.setState({});
        };
      }(f2), "function" == typeof r3.type ? r3.type.displayName || r3.type.name : "");
    }
    d2 = f2;
    y2(t2);
  }
});
b2("__e", function(i2, n3, r3, t2) {
  y2();
  d2 = void 0;
  i2(n3, r3, t2);
});
b2("diffed", function(i2, n3) {
  y2();
  d2 = void 0;
  var r3;
  if ("string" == typeof n3.type && (r3 = n3.__e)) {
    var t2 = n3.__np, f2 = n3.props, o2 = r3.U;
    if (o2) for (var e2 in o2) {
      var u2 = o2[e2];
      if (!(void 0 === u2 || t2 && e2 in t2)) {
        u2.d();
        o2[e2] = void 0;
      }
    }
    if (t2) {
      if (!o2) {
        o2 = {};
        r3.U = o2;
      }
      for (var a2 in t2) {
        var c2 = o2[a2], v2 = t2[a2];
        if (void 0 === c2) {
          c2 = k3(r3, a2, v2, f2);
          o2[a2] = c2;
        } else c2.o(v2, f2);
      }
    }
  }
  i2(n3);
});
function k3(i2, n3, r3, t2) {
  var f2 = n3 in i2 && void 0 === i2.ownerSVGElement, o2 = y(r3);
  return { o: function(i3, n4) {
    o2.value = i3;
    t2 = n4;
  }, d: x2(function() {
    this.N = M;
    var r4 = o2.value.value;
    if (t2[n3] !== r4) {
      t2[n3] = r4;
      if (f2) i2[n3] = r4;
      else if (null != r4 && (false !== r4 || "-" === n3[4])) i2.setAttribute(n3, r4);
      else i2.removeAttribute(n3);
    }
  }) };
}
b2("unmount", function(i2, n3) {
  if ("string" == typeof n3.type) {
    var r3 = n3.__e;
    if (r3) {
      var t2 = r3.U;
      if (t2) {
        r3.U = void 0;
        for (var f2 in t2) {
          var o2 = t2[f2];
          if (o2) o2.d();
        }
      }
    }
    var e2 = n3.__np;
    if (e2) {
      var u2 = n3.props;
      for (var a2 in e2) u2[a2] = e2[a2];
    }
    n3.__np = void 0;
  } else {
    var c2 = n3.__c;
    if (c2) {
      c2.__$f |= 8;
      var v2 = c2.__$u;
      if (v2) {
        c2.__$u = void 0;
        v2.d();
      }
    }
  }
  i2(n3);
});
b2("__h", function(i2, n3, r3, t2) {
  if (t2 < 3) n3.__$f |= 2;
  i2(n3, r3, t2);
});
x.prototype.shouldComponentUpdate = function(i2, n3) {
  if (this.__R) return true;
  var r3 = this.__$u, t2 = r3 && void 0 !== r3.s;
  for (var f2 in n3) return true;
  if (this.__f || "boolean" == typeof this.u && true === this.u) {
    var o2 = 2 & this.__$f;
    if (!(t2 || o2 || 4 & this.__$f)) return true;
    if (1 & this.__$f) return true;
  } else {
    if (!(t2 || 4 & this.__$f)) return true;
    if (3 & this.__$f) return true;
  }
  for (var e2 in i2) if ("__source" !== e2 && i2[e2] !== this.props[e2]) return true;
  for (var u2 in this.props) if (!(u2 in i2)) return true;
  return false;
};
function useSignal(i2, n3) {
  return w(function() {
    return y(i2, n3);
  }, []);
}
function useComputed(i2, n3) {
  var r3 = T(i2);
  r3.current = i2;
  d2.__$f |= 4;
  return w(function() {
    return O(function() {
      return r3.current();
    }, n3);
  }, []);
}
var q = "undefined" == typeof requestAnimationFrame ? setTimeout : function(i2) {
  var n3 = function() {
    clearTimeout(r3);
    cancelAnimationFrame(t2);
    i2();
  }, r3 = setTimeout(n3, 35), t2 = requestAnimationFrame(n3);
};
var A2 = function(i2) {
  queueMicrotask(function() {
    queueMicrotask(i2);
  });
};
function T3() {
  r2(function() {
    var i2;
    while (i2 = _2.shift()) h2.call(i2);
  });
}
function x3() {
  if (1 === _2.push(this)) (n.requestAnimationFrame || q)(T3);
}
function F() {
  r2(function() {
    var i2;
    while (i2 = g2.shift()) h2.call(i2);
  });
}
function M() {
  if (1 === g2.push(this)) (n.requestAnimationFrame || A2)(F);
}
function useSignalEffect(i2, n3) {
  var r3 = T(i2);
  r3.current = i2;
  var t2 = d2;
  A(function() {
    return x2(function() {
      this.N = x3;
      if (!(t2 && 8 & t2.__$f)) return r3.current();
    }, n3);
  }, []);
}
function R(i2) {
  var n3 = w(function() {
    return i2();
  }, []);
  A(function() {
    return n3[Symbol.dispose];
  }, [n3]);
  return n3;
}
export {
  l as Signal,
  E as action,
  r2 as batch,
  O as computed,
  T2 as createModel,
  x2 as effect,
  y as signal,
  f as untracked,
  useComputed,
  R as useModel,
  useSignal,
  useSignalEffect
};
//# sourceMappingURL=@preact_signals.js.map
