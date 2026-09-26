"use client";

import { useEffect } from "react";

const SOURCE_URL = "https://github.com/gabe-santana/gsantana-dev";

const frameWidth = 80;
const textWidth = frameWidth - 4;
const rule = `+${"-".repeat(frameWidth - 2)}+`;
const row = (text = "") => `| ${text.padEnd(textWidth, " ")} |`;

const consoleArt = [
  "   ,';,               ,';,",
  " ,' , :;             ; ,,.;",
  " | |:; :;           ; ;:|.|",
  " | |::; ';,,,,,,,,,'  ;:|.|    ,,,;;;;;;;;,,,",
  " ; |''  ___      ___   ';.;,,''             ''';,,,",
  " ',:   /   \\    /   \\    .;.                      '';,",
  " ;    /    |    |    \\     ;,                        ';,",
  ";    |    /|    |\\    |    :|                          ';,",
  "|    |    \\|    |/    |    :|     ,,,,,,,               ';,",
  "|     \\____| __ |____/     :;  ,''                        ;,",
  ";           /  \\          :; ,'                           :;",
  " ',        `----'        :; |'                            :|",
  "   ',,  `----------'  ..;',|'                             :|",
  "  ,'  ',,,,,,,,,,,;;;;''  |'                              :;",
  ",'  ,,,,                  |,                              :;",
  "| ,'   :;, ,,''''''''''   '|.   ...........                ';,",
  ";       :;|               ,,';;;''''''                      ';,",
  " ',,,,,;;;|.............,'                          ....      ;,",
  "           ''''''''''''|        .............;;;;;;;''''',    ':;",
  "                       |;;;;;;;;'''''''''''''             ;    :|",
  "                                                      ,,,'     :;",
  "                                          ,,,,,,,,,,''       .;'",
  "                                         |              .;;;;'",
  "                                         ';;;;;;;;;;;;;;'",
];

const criticalPrefix = "DEVTOOLS BREACH DETECTED: curiosity level: ";
const criticalWord = "CRITICAL";
const criticalLine = `${criticalPrefix}${criticalWord}`;
const criticalLineStart = `| ${criticalPrefix}`;
const criticalLineEnd = `${" ".repeat(textWidth - criticalLine.length)} |`;

const asciiBeforeCritical = [
  rule,
  ...consoleArt.map((line) => row(line)),
  row(),
].join("\n");

const asciiAfterCritical = [
  row(),
  row("Hold up. Why are you opening the walls?"),
  row(),
  row("Looking for secrets, bugs, or the emergency button labeled"),
  row('"ship it and pretend this was architecture"?'),
  row(),
  row("Good news: the source code is already public."),
  row("Read the spellbook before poking production with a stick:"),
  row(),
  row(SOURCE_URL),
  row(),
  row("P.S. If you find something weird, congratulations:"),
  row("you are now part of the architecture review."),
  rule,
].join("\n");

const baseStyle = [
  "color: #5eead4",
  "background: #05070d",
  "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  "font-weight: 800",
  "line-height: 1.15",
  "padding: 8px 0",
  "text-shadow: 0 0 12px rgba(94, 234, 212, 0.65)",
].join(";");

const criticalStyle = [
  "color: #ffffff",
  "background: #dc2626",
  "font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  "font-weight: 900",
  "line-height: 1.15",
  "padding: 1px 4px",
  "text-decoration: blink",
  "animation: gsantana-critical-blink 1s steps(2, start) infinite",
  "text-shadow: 0 0 10px rgba(255, 255, 255, 0.9)",
].join(";");

declare global {
  interface Window {
    __gsantanaConsoleEasterEgg?: boolean;
  }
}

export function ConsoleEasterEgg() {
  useEffect(() => {
    if (window.__gsantanaConsoleEasterEgg) return;
    window.__gsantanaConsoleEasterEgg = true;

    console.log(
      `%c${asciiBeforeCritical}\n${criticalLineStart}%c${criticalWord}%c${criticalLineEnd}\n${asciiAfterCritical}`,
      baseStyle,
      criticalStyle,
      baseStyle,
    );
  }, []);

  return null;
}
