import type { SportId } from "../../lib/sport"

// 四个动作的内联 SVG。统一 7 头身、侧视为主，关节是嵌套的 <g>，动画用 CSS 旋转，
// transform-origin 直接写关节坐标（transform-box: view-box）。
// 远侧手脚不换位置、只换颜色并延迟半周期，看上去就是侧后方的肢体。

export default function SportFigure({ sport }: { sport: SportId }) {
  if (sport === "run") return <RunFigure />
  if (sport === "bike") return <BikeFigure />
  if (sport === "swim") return <SwimFigure />
  return <RopeFigure />
}

/** 跑步：侧视，摆臂 + 屈膝蹬地 */
function RunFigure() {
  return (
    <svg className="figure run" viewBox="0 0 220 220" aria-hidden="true">
      <ellipse className="shadow" cx="108" cy="201" rx="34" ry="5" />

      <g className="body">
        {/* 远侧腿 */}
        <g
          className="thigh far"
          style={{
            transformOrigin: "102px 112px",
            animationDelay: "calc(var(--cycle) * -0.5)",
          }}
        >
          <path className="limb far" d="M102 112 L102 154" />
          <g className="shin" style={{ transformOrigin: "102px 154px" }}>
            <path className="limb far" d="M102 154 L102 190" />
            <g className="shoe far" style={{ transformOrigin: "102px 190px" }}>
              <path d="M97 188 h8 q6 0 8 3 l1 3 q0 3 -3 3 h-12 q-3 0 -3 -3 z" />
              <path className="sole" d="M97 196 h17 q2 0 2 2 h-19 z" />
            </g>
          </g>
        </g>

        {/* 远侧手臂 */}
        <g
          className="arm-swing far"
          style={{
            transformOrigin: "122px 74px",
            animationDelay: "calc(var(--cycle) * -0.5)",
          }}
        >
          <path className="limb arm far" d="M122 74 L122 102" />
          <g className="fore" style={{ transformOrigin: "122px 102px" }}>
            <path className="limb arm far" d="M122 102 L122 126" />
            <circle className="hand far" cx="122" cy="128" r="4.5" />
          </g>
        </g>

        {/* 短裤 + 上衣 */}
        <rect className="neck" x="106" y="54" width="12" height="13" rx="5" />
        <path
          className="shorts"
          d="M94 106 h28 v14 q0 10 -10 10 h-8 q-10 0 -10 -10 z"
        />
        <path
          className="shirt"
          d="M94 68 q0 -8 10 -8 h12 q10 0 10 8 l1 32 q0 8 -8 8 h-18 q-8 0 -8 -8 z"
        />

        {/* 头 */}
        <g transform="translate(114 44)">
          <circle className="skin" r="12" />
          <path
            className="hair"
            d="M-12 -1 Q-12 -12 0 -12 Q10 -12 12 -4 Q8 -7 4 -7 Q1 -10 -4 -8 Q-8 -6 -9 0 Q-10 3 -12 2 Z"
          />
          <circle className="eye" cx="5" cy="2" r="1.6" />
          <path className="nose" d="M11 4 q1.5 1.5 0 3" />
          <path className="mouth" d="M7 8 q2 1.5 4 0" />
        </g>

        {/* 近侧腿 */}
        <g className="thigh" style={{ transformOrigin: "106px 112px" }}>
          <path className="limb" d="M106 112 L106 154" />
          <g className="shin" style={{ transformOrigin: "106px 154px" }}>
            <path className="limb" d="M106 154 L106 190" />
            <g className="shoe" style={{ transformOrigin: "106px 190px" }}>
              <path d="M99 188 h8 q6 0 8 3 l1 3 q0 3 -3 3 h-12 q-3 0 -3 -3 z" />
              <path className="sole" d="M99 196 h17 q2 0 2 2 h-19 z" />
            </g>
          </g>
        </g>

        {/* 近侧手臂 */}
        <g className="arm-swing" style={{ transformOrigin: "122px 74px" }}>
          <path className="limb arm" d="M122 74 L122 102" />
          <g className="fore" style={{ transformOrigin: "122px 102px" }}>
            <path className="limb arm" d="M122 102 L122 126" />
            <circle className="hand" cx="122" cy="128" r="4.5" />
          </g>
        </g>
      </g>
    </svg>
  )
}

/** 骑行：侧视，曲柄整圈带动双腿（2-link IK 反推的大腿/膝盖角度） */
function BikeFigure() {
  return (
    <svg className="figure bike" viewBox="0 0 220 220" aria-hidden="true">
      <ellipse className="shadow" cx="102" cy="191" rx="64" ry="7" />

      {/* 远侧腿 */}
      <g
        className="thigh far"
        style={{
          transformOrigin: "86px 100px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb far" d="M86 100 L86 138" />
        <g className="shin" style={{ transformOrigin: "86px 138px" }}>
          <path className="limb far" d="M86 138 L86 174" />
          <g className="shoe far" style={{ transformOrigin: "86px 174px" }}>
            <path d="M80 172 h9 q7 0 9 4 l1 3 q0 3 -3 3 h-14 q-3 0 -3 -3 z" />
            <path className="sole" d="M80 180 h19 q2 0 2 2 h-21 z" />
          </g>
        </g>
      </g>

      {/* 远侧手臂 */}
      <path className="limb arm far" d="M100 76 L120 88 L138 98" />
      <circle className="hand far" cx="138" cy="98" r="4.5" />

      {/* 车轮 */}
      <g className="wheel" style={{ transformOrigin: "54px 164px" }}>
        <circle cx="54" cy="164" r="26" />
        <circle className="rim" cx="54" cy="164" r="21" />
        <g className="spokes">
          <path d="M54 143 V185" />
          <path d="M33 164 H75" />
          <path d="M39 149 L69 179" />
          <path d="M69 149 L39 179" />
        </g>
        <circle className="hub" cx="54" cy="164" r="3.5" />
      </g>
      <g className="wheel" style={{ transformOrigin: "150px 164px" }}>
        <circle cx="150" cy="164" r="26" />
        <circle className="rim" cx="150" cy="164" r="21" />
        <g className="spokes">
          <path d="M150 143 V185" />
          <path d="M129 164 H171" />
          <path d="M135 149 L165 179" />
          <path d="M165 149 L135 179" />
        </g>
        <circle className="hub" cx="150" cy="164" r="3.5" />
      </g>

      {/* 车架 */}
      <g className="frame">
        <path d="M54 164 L100 162" />
        <path d="M54 164 L86 100" />
        <path d="M86 100 L100 162" />
        <path d="M100 162 L140 100" />
        <path d="M86 100 L140 100" />
        <path d="M140 100 L150 164" />
        <path d="M140 100 L146 94" />
        <path d="M140 94 Q150 94 150 102" />
        <path className="saddle" d="M78 98 q10 -4 18 0 l-2 6 q-7 2 -14 0 z" />
      </g>

      {/* 曲柄 + 踏板 */}
      <g className="crank">
        <path d="M100 162 L100 152" />
        <path d="M100 162 L100 172" />
        <rect x="95" y="150" width="10" height="4" rx="2" />
        <rect x="95" y="170" width="10" height="4" rx="2" />
      </g>

      {/* 近侧腿 */}
      <g className="thigh" style={{ transformOrigin: "86px 100px" }}>
        <path className="limb" d="M86 100 L86 138" />
        <g className="shin" style={{ transformOrigin: "86px 138px" }}>
          <path className="limb" d="M86 138 L86 174" />
          <g className="shoe" style={{ transformOrigin: "86px 174px" }}>
            <path d="M80 172 h9 q7 0 9 4 l1 3 q0 3 -3 3 h-14 q-3 0 -3 -3 z" />
            <path className="sole" d="M80 180 h19 q2 0 2 2 h-21 z" />
          </g>
        </g>
      </g>

      {/* 上身 */}
      <g transform="rotate(30 86 100)">
        <rect className="shorts" x="74" y="94" width="26" height="24" rx="8" />
        <path
          className="shirt"
          d="M72 74 q0 -10 10 -10 h8 q10 0 10 10 l1 24 q0 8 -8 8 h-14 q-8 0 -8 -8 z"
        />
      </g>
      <path className="limb" d="M102 74 L108 68" />
      <g transform="translate(112 64) rotate(12)">
        <circle className="skin" r="12" />
        <path
          className="hair"
          d="M-12 0 Q-12 -11 0 -11 Q10 -11 12 -3 Q8 -6 4 -6 Q1 -9 -4 -7 Q-8 -5 -9 1 Q-10 3 -12 2 Z"
        />
        <path
          className="helmet"
          d="M-12 1 A12 12 0 0 1 11 -3 L15 -2 Q17 1 12 2 L-9 3 Q-12 3 -12 1 Z"
        />
        <circle className="eye" cx="6" cy="5" r="1.6" />
        <path className="nose" d="M11 6 q1.5 1.5 0 3" />
        <path className="mouth" d="M7 10 q2 1.2 4 0" />
      </g>

      {/* 近侧手臂 */}
      <path className="limb arm" d="M104 78 L122 90 L140 100" />
      <circle className="hand" cx="140" cy="100" r="4.5" />
    </svg>
  )
}

/** 游泳：自由泳侧视，风车划水 + 水平打腿，水面之下压一层水色 */
function SwimFigure() {
  return (
    <svg className="figure swim" viewBox="0 0 220 220" aria-hidden="true">
      {/* 远侧手臂 */}
      <g
        className="arm-swing far"
        style={{
          transformOrigin: "136px 128px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb arm far" d="M136 128 L136 152" />
        <g className="fore" style={{ transformOrigin: "136px 152px", transform: "rotate(-25deg)" }}>
          <path className="limb arm far" d="M136 152 L136 174" />
          <circle className="hand far" cx="136" cy="176" r="4.5" />
        </g>
      </g>

      {/* 远侧腿 */}
      <g
        className="sw-leg far"
        style={{
          transformOrigin: "62px 141px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb far" d="M62 141 L42 137 L22 140" />
      </g>

      {/* 身体 */}
      <rect className="trunks" x="52" y="122" width="36" height="28" rx="12" />
      <path
        className="skin"
        d="M82 122 Q110 116 138 122 L140 136 Q140 148 128 148 H92 Q80 148 80 136 Z"
      />
      <path className="neck-line" d="M138 130 L150 132" />

      {/* 近侧腿 */}
      <g className="sw-leg" style={{ transformOrigin: "62px 136px" }}>
        <path className="limb" d="M62 136 L42 132 L22 135" />
      </g>

      {/* 近侧手臂 */}
      <g className="arm-swing" style={{ transformOrigin: "136px 128px" }}>
        <path className="limb arm" d="M136 128 L136 152" />
        <g className="fore" style={{ transformOrigin: "136px 152px", transform: "rotate(-25deg)" }}>
          <path className="limb arm" d="M136 152 L136 174" />
          <circle className="hand" cx="136" cy="176" r="4.5" />
        </g>
      </g>

      {/* 水面以下压一层水色，头再画上来 */}
      <rect className="water-glass" x="-600" y="134" width="1300" height="90" />
      <g className="head" style={{ transformOrigin: "152px 130px" }}>
        <g transform="translate(152 130) rotate(12)">
          <circle className="skin" r="12" />
          <path
            className="cap"
            d="M-12 1 A12 12 0 0 1 12 -2 Q14 2 10 3 L-10 3 Q-13 3 -12 1 Z"
          />
          <path
            className="goggle"
            d="M10 0 q3 0 3 3 q0 3 -3 3 q-3 0 -3 -3 q0 -3 3 -3 z"
          />
          <path className="nose" d="M12 4 q2 1 0 3" />
          <path className="mouth" d="M8 9 h4" />
        </g>
      </g>
    </svg>
  )
}

/** 跳绳：正视，静态绳圈 + 沿线移动的绳段，人物整体起跳 */
function RopeFigure() {
  return (
    <svg className="figure rope" viewBox="0 0 220 220" aria-hidden="true">
      <ellipse className="shadow" cx="110" cy="202" rx="30" ry="5" />

      <g className="body">
        {/* 绳圈在身体后面，绳段沿椭圆移动；整体跟着手一起起跳 */}
        <ellipse className="rope-loop" cx="110" cy="116" rx="26" ry="84" />
        <ellipse className="rope-run" cx="110" cy="116" rx="26" ry="84" />

        {/* 腿 */}
        <path className="limb far" d="M114 132 L118 160 L118 190" />
        <rect className="shoe far" x="109" y="188" width="20" height="9" rx="4" />
        <path className="limb" d="M106 132 L102 160 L102 190" />
        <rect className="shoe" x="93" y="188" width="20" height="9" rx="4" />

        {/* 躯干 */}
        <rect className="shorts" x="94" y="106" width="32" height="28" rx="8" />
        <path
          className="shirt"
          d="M92 80 q0 -12 18 -12 q18 0 18 12 l1 28 q0 8 -8 8 h-22 q-8 0 -8 -8 z"
        />
        <rect className="neck" x="105" y="56" width="10" height="14" rx="4" />

        {/* 头 */}
        <g transform="translate(110 46)">
          <circle className="skin" r="12" />
          <path
            className="hair"
            d="M-12 0 Q-12 -12 0 -12 Q12 -12 12 0 Q8 -4 4 -6 Q0 -9 -5 -6 Q-9 -4 -12 0 Z"
          />
          <circle className="eye" cx="-4.5" cy="3" r="1.6" />
          <circle className="eye" cx="4.5" cy="3" r="1.6" />
          <path className="mouth" d="M-2 9 h4" />
        </g>

        {/* 手臂与手柄 */}
        <path className="limb arm" d="M94 84 L88 102 L84 116" />
        <path className="limb arm" d="M126 84 L132 102 L136 116" />
        <path className="handle" d="M82 116 h4" />
        <path className="handle" d="M134 116 h4" />
        <circle className="hand" cx="84" cy="116" r="4.5" />
        <circle className="hand" cx="136" cy="116" r="4.5" />
      </g>
    </svg>
  )
}
