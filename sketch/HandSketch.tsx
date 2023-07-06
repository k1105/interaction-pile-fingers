import dynamic from "next/dynamic";
import p5Types from "p5";
import { MutableRefObject, useRef } from "react";
import { Hand } from "@tensorflow-models/hand-pose-detection";
import { getSmoothedHandpose } from "../lib/getSmoothedHandpose";
import { updateHandposeHistory } from "../lib/updateHandposeHistory";
import { Keypoint } from "@tensorflow-models/hand-pose-detection";
import { convertHandToHandpose } from "../lib/converter/convertHandToHandpose";
import { dotHand } from "../lib/p5/dotHand";
import { isFront } from "../lib/calculator/isFront";
import { Monitor } from "./Monitor";

type Props = {
  handpose: MutableRefObject<Hand[]>;
};

let leftHand: Keypoint[] = [];
let rightHand: Keypoint[] = [];
let leftHandOpacity: number = 0;
let rightHandOpacity: number = 0;
const mainColor = 0;

type Handpose = Keypoint[];

const Sketch = dynamic(import("react-p5"), {
  loading: () => <></>,
  ssr: false,
});

export const HandSketch = ({ handpose }: Props) => {
  let handposeHistory: {
    left: Handpose[];
    right: Handpose[];
  } = { left: [], right: [] };

  const debugLog = useRef<{ label: string; value: any }[]>([]);

  const preload = (p5: p5Types) => {
    // 画像などのロードを行う
  };

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
    p5.stroke(mainColor);
    p5.fill(mainColor);
    p5.strokeWeight(10);
  };

  const draw = (p5: p5Types) => {
    const rawHands: {
      left: Handpose;
      right: Handpose;
    } = convertHandToHandpose(handpose.current);
    handposeHistory = updateHandposeHistory(rawHands, handposeHistory); //handposeHistoryの更新
    const hands: {
      left: Handpose;
      right: Handpose;
    } = getSmoothedHandpose(rawHands, handposeHistory); //平滑化された手指の動きを取得する

    // logとしてmonitorに表示する
    debugLog.current = [];
    for (const hand of handpose.current) {
      debugLog.current.push({
        label: hand.handedness + " accuracy",
        value: hand.score,
      });
      debugLog.current.push({
        label: hand.handedness + " is front",
        //@ts-ignore
        value: isFront(hand.keypoints, hand.handedness.toLowerCase()),
      });
    }

    p5.clear(); // --
    // <> pinky
    // <> ring
    // <> middle
    // <> index
    // <> thumb
    // --
    // if one hand is detected, both side of organ is shrink / extend.
    // if two hands are detected, each side of organ changes according to each hand.
    const r = 150; // <の長さ.
    const offset = 60; // 左右の手指の出力位置の間隔
    const scale = 1; // 指先と付け根の距離の入力値に対する、出力時に使うスケール比。
    const fingerNames = [
      "thumb",
      "index finger",
      "middle finger",
      "ring finger",
      "pinky",
    ];
    let start: number = 0;
    let end: number = 0;

    if (hands.left.length > 0 || hands.right.length > 0) {
      //右手、左手のうちのどちらかが認識されていた場合
      // 片方の手の動きをもう片方に複製する
      if (hands.left.length == 0) {
        hands.left = hands.right;
      } else if (hands.right.length == 0) {
        hands.right = hands.left;
      }

      p5.translate(window.innerWidth / 2, (2 * window.innerHeight) / 3);

      let yBase = 0;

      for (let n = 0; n < 5; n++) {
        start = 4 * n + 1;
        end = 4 * n + 4;

        const left_d = (hands.left[end].y - hands.left[start].y) * scale;
        const right_d = (hands.right[end].y - hands.right[start].y) * scale;

        [left_d, right_d].forEach((d, index) => {
          const sign = (-1) ** (1 - index); //正負の符号
          p5.push();
          p5.translate(sign * offset, yBase);
          d = Math.min(Math.max(-r, d), 0);
          p5.line(0, 0, (sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2);
          p5.line((sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2, 0, d);

          p5.pop();
        });

        //全体座標の回転と高さ方向へのtranslate
        let tmp_l_d = 0;
        let tmp_r_d = 0;

        if (r < Math.abs(left_d)) {
          tmp_l_d = -r;
        } else if (left_d > 0) {
          tmp_l_d = 0;
        } else {
          tmp_l_d = left_d;
        }
        if (r < Math.abs(right_d)) {
          tmp_r_d = -r;
        } else if (right_d > 0) {
          tmp_r_d = 0;
        } else {
          tmp_r_d = right_d;
        }

        yBase += (tmp_l_d + tmp_r_d) / 2;
        p5.rotate(-Math.atan2(tmp_l_d - tmp_r_d, 2 * offset));
      }
    }
  };

  const windowResized = (p5: p5Types) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <>
      <Monitor handpose={handpose} debugLog={debugLog} />
      <Sketch
        preload={preload}
        setup={setup}
        draw={draw}
        windowResized={windowResized}
      />
    </>
  );
};
