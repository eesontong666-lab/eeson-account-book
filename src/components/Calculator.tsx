"use client";

import { useState } from "react";

type Operator = "+" | "-" | "×" | "÷";

function applyOp(a: number, b: number, op: Operator): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? NaN : a / b;
}

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Operator | null>(null);
  // true right after pressing an operator or "=" — the next digit should start a fresh number
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  function inputDigit(d: string) {
    if (waitingForOperand) {
      setDisplay(d);
      setWaitingForOperand(false);
    } else if (display === "0") {
      setDisplay(d);
    } else {
      setDisplay(display + d);
    }
  }

  function inputDot() {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  }

  function clear() {
    setDisplay("0");
    setStored(null);
    setPendingOp(null);
    setWaitingForOperand(false);
  }

  function backspace() {
    if (waitingForOperand) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  }

  function chooseOp(op: Operator) {
    const current = parseFloat(display);
    if (stored !== null && pendingOp && !waitingForOperand) {
      const result = applyOp(stored, current, pendingOp);
      setStored(result);
      setDisplay(String(result));
    } else {
      setStored(current);
    }
    setPendingOp(op);
    setWaitingForOperand(true);
  }

  function equals() {
    if (stored === null || !pendingOp) return;
    const current = parseFloat(display);
    const result = applyOp(stored, current, pendingOp);
    setDisplay(Number.isNaN(result) ? "错误" : String(result));
    setStored(null);
    setPendingOp(null);
    setWaitingForOperand(true);
  }

  const btn = "py-3 rounded-xl text-sm font-medium transition active:scale-95";
  const numBtn = `${btn} bg-neutral-800 text-neutral-100 hover:bg-neutral-700`;
  const opBtn = `${btn} bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30`;
  const fnBtn = `${btn} bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200`;

  return (
    <div className="max-w-xs flex flex-col gap-3">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 text-right">
        <p className="text-2xl font-semibold text-neutral-100 truncate">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className={fnBtn}>
          C
        </button>
        <button onClick={backspace} className={fnBtn}>
          ⌫
        </button>
        <button onClick={() => chooseOp("÷")} className={opBtn}>
          ÷
        </button>
        <button onClick={() => chooseOp("×")} className={opBtn}>
          ×
        </button>

        <button onClick={() => inputDigit("7")} className={numBtn}>
          7
        </button>
        <button onClick={() => inputDigit("8")} className={numBtn}>
          8
        </button>
        <button onClick={() => inputDigit("9")} className={numBtn}>
          9
        </button>
        <button onClick={() => chooseOp("-")} className={opBtn}>
          -
        </button>

        <button onClick={() => inputDigit("4")} className={numBtn}>
          4
        </button>
        <button onClick={() => inputDigit("5")} className={numBtn}>
          5
        </button>
        <button onClick={() => inputDigit("6")} className={numBtn}>
          6
        </button>
        <button onClick={() => chooseOp("+")} className={opBtn}>
          +
        </button>

        <button onClick={() => inputDigit("1")} className={numBtn}>
          1
        </button>
        <button onClick={() => inputDigit("2")} className={numBtn}>
          2
        </button>
        <button onClick={() => inputDigit("3")} className={numBtn}>
          3
        </button>
        <button onClick={equals} className={`${opBtn} row-span-2`}>
          =
        </button>

        <button onClick={() => inputDigit("0")} className={`${numBtn} col-span-2`}>
          0
        </button>
        <button onClick={inputDot} className={numBtn}>
          .
        </button>
      </div>
    </div>
  );
}
