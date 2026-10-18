import type { SportId } from "../../lib/sport"

// 四个动作的内联 SVG。人物按 14 岁男生比例（约 6.5 头身，1.65m）画：
// 关节是嵌套的 <g>，动画用 CSS 旋转，transform-origin 直接写关节坐标（transform-box: view-box）。
// 远侧手脚不换位置、只换颜色，动作完全同步，看上去就是侧后方的肢体。

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
      <ellipse className="shadow" cx="106" cy="199" rx="36" ry="6" />

      <g className="body">
        {/* 远侧腿：与近侧腿同一个动画，延迟半个周期 */}
        <g
          className="thigh far"
          style={{
            transformOrigin: "102px 118px",
            animationDelay: "calc(var(--cycle) * -0.5)",
          }}
        >
          <path className="limb far" d="M102 118 L102 158" />
          <g className="shin" style={{ transformOrigin: "102px 158px" }}>
            <path className="limb far" d="M102 158 L102 194" />
            <path className="shoe far" d="M94 188 h9 q9 0 12 6 l1 3 q0 2 -3 2 h-18 q-3 0 -3 -3 z" />
          </g>
        </g>

        {/* 远侧手臂 */}
        <g
          className="arm-swing far"
          style={{
            transformOrigin: "110px 74px",
            animationDelay: "calc(var(--cycle) * -0.5)",
          }}
        >
          <path className="limb arm far" d="M110 74 L110 100" />
          <g className="fore" style={{ transformOrigin: "110px 100px" }}>
            <path className="limb arm far" d="M110 100 L110 125" />
            <circle className="hand far" cx="110" cy="127" r="5" />
          </g>
        </g>

        {/* 短裤 + 上衣 */}
        <rect className="shorts" x="86" y="112" width="36" height="25" rx="8" transform="rotate(8 104 118)" />
        <path className="shirt" d="M88 84 q0 -16 16 -16 q16 0 16 16 l1 28 q0 10 -10 10 h-14 q-10 0 -10 -10 z" transform="rotate(8 104 118)" />
        <rect className="neck" x="104" y="52" width="12" height="18" rx="5" transform="rotate(8 104 118)" />

        {/* 头 */}
        <g transform="translate(116 44)">
          <circle className="skin" r="13" />
          <path className="hair" d="M-11 6.9 A13 13 0 1 1 12.8 -2.4 Z" />
          <circle className="eye" cx="6" cy="4" r="1.9" />
          <path className="mouth" d="M4 9 q3 2.4 5 0" />
        </g>

        {/* 近侧腿 */}
        <g className="thigh" style={{ transformOrigin: "102px 118px" }}>
          <path className="limb" d="M102 118 L102 158" />
          <g className="shin" style={{ transformOrigin: "102px 158px" }}>
            <path className="limb" d="M102 158 L102 194" />
            <path className="shoe" d="M94 188 h9 q9 0 12 6 l1 3 q0 2 -3 2 h-18 q-3 0 -3 -3 z" />
          </g>
        </g>

        {/* 近侧手臂 */}
        <g className="arm-swing" style={{ transformOrigin: "110px 74px" }}>
          <path className="limb arm" d="M110 74 L110 100" />
          <g className="fore" style={{ transformOrigin: "110px 100px" }}>
            <path className="limb arm" d="M110 100 L110 125" />
            <circle className="hand" cx="110" cy="127" r="5" />
          </g>
        </g>
      </g>
    </svg>
  )
}

/** 骑行：侧视，曲柄整圈带动双腿（角度由腿部 IK 反推） */
function BikeFigure() {
  return (
    <svg className="figure bike" viewBox="0 0 220 220" aria-hidden="true">
      <ellipse className="shadow" cx="102" cy="191" rx="64" ry="7" />

      {/* 远侧腿 */}
      <g
        className="thigh far"
        style={{
          transformOrigin: "75px 112px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb far" d="M75 112 L75 146" />
        <g className="shin" style={{ transformOrigin: "75px 146px" }}>
          <path className="limb far" d="M75 146 L75 181" />
          <path className="shoe far" d="M68 176 h10 q9 0 11 5 l1 3 q0 2 -3 2 h-17 q-3 0 -3 -3 z" />
        </g>
      </g>

      {/* 车轮 */}
      <g className="wheels">
        <g className="wheel">
          <circle cx="54" cy="164" r="26" />
          <circle className="rim" cx="54" cy="164" r="21" />
          <circle className="hub" cx="54" cy="164" r="3.5" />
        </g>
        <g className="wheel">
          <circle cx="150" cy="164" r="26" />
          <circle className="rim" cx="150" cy="164" r="21" />
          <circle className="hub" cx="150" cy="164" r="3.5" />
        </g>
      </g>

      {/* 车架 */}
      <g className="frame">
        <path d="M54 164 L102 164" />
        <path d="M54 164 L76 118" />
        <path d="M102 164 L75 120" />
        <path d="M102 164 L139 100" />
        <path d="M78 116 L131 94" />
        <path d="M141 106 q4 22 9 58" />
        <path d="M134 92 q11 1 11 9 q0 4 -4 6" />
        <path className="saddle" d="M64 114 q11 -5 22 0 l-3 6 q-8 3 -16 0 z" />
      </g>

      {/* 曲柄 + 踏板 */}
      <g className="crank">
        <path d="M102 164 L102 155" />
        <path d="M102 164 L102 173" />
        <rect x="97" y="152" width="11" height="4" rx="2" />
        <rect x="97" y="172" width="11" height="4" rx="2" />
      </g>

      {/* 近侧腿 */}
      <g className="thigh" style={{ transformOrigin: "75px 112px" }}>
        <path className="limb" d="M75 112 L75 146" />
        <g className="shin" style={{ transformOrigin: "75px 146px" }}>
          <path className="limb" d="M75 146 L75 181" />
          <path className="shoe" d="M68 176 h10 q9 0 11 5 l1 3 q0 2 -3 2 h-17 q-3 0 -3 -3 z" />
        </g>
      </g>

      {/* 上身 */}
      <g transform="rotate(39.5 75 114)">
        <rect className="shorts" x="63" y="102" width="27" height="21" rx="8" />
        <path className="shirt" d="M61 76 q0 -14 14 -14 q14 0 14 14 l1 24 q0 9 -9 9 h-12 q-9 0 -9 -9 z" />
      </g>
      <path className="limb arm" d="M104 79 L118 93 L141 97" />
      <circle className="hand" cx="141" cy="97" r="5.5" />
      <g transform="translate(116 62) rotate(20)">
        <circle className="skin" r="12" />
        <path className="hair" d="M-11.9 1.5 A12 12 0 0 1 11.9 1.5 Z" />
        <circle className="eye" cx="6" cy="4" r="1.8" />
        <path className="mouth" d="M4 9 q3 2 5 0" />
        <path className="helmet" d="M-13 0 A14 14 0 0 1 13 -2 l6 1 q3 2 1 4 l-7 -1 l-24 0 z" />
      </g>
    </svg>
  )
}

/** 游泳：自由泳侧视，风车划水 + 打腿，水面之下压一层水色 */
function SwimFigure() {
  return (
    <svg className="figure swim" viewBox="0 0 220 220" aria-hidden="true">
      {/* 远侧手臂 */}
      <g
        className="arm-swing far"
        style={{
          transformOrigin: "140px 126px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb arm far" d="M140 126 L140 154" />
        <g className="fore" style={{ transformOrigin: "140px 154px", transform: "rotate(-45deg)" }}>
          <path className="limb arm far" d="M140 154 L140 178" />
          <circle className="hand far" cx="140" cy="180" r="4.5" />
        </g>
      </g>

      {/* 远侧腿 */}
      <g
        className="sw-leg far"
        style={{
          transformOrigin: "80px 136px",
          animationDelay: "calc(var(--cycle) * -0.5)",
        }}
      >
        <path className="limb far" d="M80 136 L52 133 L26 137" />
      </g>

      {/* 身体 */}
      <rect className="trunks" x="70" y="122" width="32" height="30" rx="12" />
      <rect className="skin" x="82" y="124" width="62" height="26" rx="13" />
      <path className="neck-line" d="M138 132 L166 136" />
      <path className="limb arm" d="M140 126 L140 154" />
      <g className="fore" style={{ transformOrigin: "140px 154px", transform: "rotate(-45deg)" }}>
        <path className="limb arm" d="M140 154 L140 178" />
        <circle className="hand" cx="140" cy="180" r="4.5" />
      </g>

      {/* 近侧腿 */}
      <g className="sw-leg" style={{ transformOrigin: "80px 136px" }}>
        <path className="limb" d="M80 136 L52 133 L26 137" />
      </g>

      {/* 水面以下压一层水色，头再画上来 */}
      <rect className="water-glass" x="-600" y="132" width="1300" height="90" />
      <g className="head" style={{ transformOrigin: "178px 130px" }}>
        <g transform="translate(178 130) rotate(16)">
          <circle className="skin" r="13" />
          <path className="cap" d="M-13 0 a13 13 0 0 1 26 0 q-3 -7 -13 -7 q-10 0 -13 7 z" />
          <path className="goggle" d="M11 1 q3 0 3 3 q0 3 -3 3 q-3 0 -3 -3 q0 -3 3 -3 z" />
          <path className="mouth" d="M9 10 q3 2 5 0" />
        </g>
      </g>
    </svg>
  )
}

/** 跳绳：正视，整体起跳 + 绳子整圈扫过 */
function RopeFigure() {
  return (
    <svg className="figure rope" viewBox="0 0 220 220" aria-hidden="true">
      <ellipse className="shadow" cx="110" cy="202" rx="30" ry="6" />

      <g className="body">
        {/* 绳子跟着人一起起跳，整圈扫过（控制点放远，绳腹才够低、绕手一圈） */}
        <g className="rope-arc" style={{ transformOrigin: "110px 122px" }}>
          <path d="M84 122 Q110 288 136 122" />
        </g>

        {/* 腿 */}
        <g className="legs">
          <path className="limb far" d="M117 122 L120 158 L120 190" />
          <path className="shoe far" d="M109 187 h13 q5 0 5 6 q0 5 -6 5 h-7 q-5 0 -5 -5 z" />
          <path className="limb" d="M103 122 L100 158 L100 190" />
          <path className="shoe" d="M93 186 h13 q5 0 5 6 q0 5 -6 5 h-7 q-5 0 -5 -5 z" />
        </g>

        {/* 躯干 */}
        <rect className="shorts" x="94" y="114" width="32" height="30" rx="8" />
        <path className="shirt" d="M92 92 q0 -16 18 -16 q18 0 18 16 l1 30 q0 8 -8 8 h-22 q-8 0 -8 -8 z" />
        <rect className="neck" x="105" y="66" width="10" height="12" rx="4" />

        {/* 头 */}
        <g transform="translate(110 52)">
          <circle className="skin" r="13" />
          <path className="hair" d="M-12.8 1.5 A13 13 0 0 1 12.8 1.5 Z" />
          <circle className="eye" cx="-5" cy="4" r="1.9" />
          <circle className="eye" cx="5" cy="4" r="1.9" />
          <path className="mouth" d="M-3 9 q3 3 6 0" />
        </g>

        {/* 手臂与手柄 */}
        <path className="limb arm" d="M95 82 L88 100 L86 120" />
        <path className="limb arm" d="M125 82 L132 100 L134 120" />
        <path className="handle" d="M84 120 L88 120" />
        <path className="handle" d="M132 120 L136 120" />
        <circle className="hand" cx="86" cy="120" r="4.5" />
        <circle className="hand" cx="134" cy="120" r="4.5" />
      </g>
    </svg>
  )
}
