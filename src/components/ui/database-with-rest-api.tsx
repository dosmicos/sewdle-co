"use client";
import React from "react";
import { motion } from "framer-motion";
import { Folder, HeartHandshakeIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatabaseWithRestApiProps {
  className?: string;
  circleText?: string;
  badgeTexts?: {
    first: string;
    second: string;
    third: string;
    fourth: string;
  };
  buttonTexts?: {
    first: string;
    second: string;
  };
  title?: string;
  lightColor?: string;
}

const DatabaseWithRestApi = ({
  className,
  circleText,
  badgeTexts,
  buttonTexts,
  title,
  lightColor,
}: DatabaseWithRestApiProps) => {
  return (
    <div
      className={cn(
        "relative flex h-[350px] w-full max-w-[500px] flex-col items-center",
        className
      )}
    >
      {/* SVG Paths  */}
      <svg
        className="h-full sm:w-full text-gray-300"
        width="100%"
        height="100%"
        viewBox="0 0 200 100"
      >
        <g
          stroke="currentColor"
          fill="none"
          strokeWidth="0.4"
          strokeDasharray="100 100"
          pathLength="100"
        >
          <path d="M 31 10 v 15 q 0 5 5 5 h 59 q 5 0 5 5 v 10" />
          <path d="M 77 10 v 10 q 0 5 5 5 h 13 q 5 0 5 5 v 10" />
          <path d="M 124 10 v 10 q 0 5 -5 5 h -14 q -5 0 -5 5 v 10" />
          <path d="M 170 10 v 15 q 0 5 -5 5 h -60 q -5 0 -5 5 v 10" />
          <animate
            attributeName="stroke-dashoffset"
            from="100"
            to="0"
            dur="1s"
            fill="freeze"
            calcMode="spline"
            keySplines="0.25,0.1,0.5,1"
            keyTimes="0; 1"
          />
        </g>
        {/* Orange Lights */}
        <g mask="url(#db-mask-1)">
          <circle
            className="database db-light-1"
            cx="0"
            cy="0"
            r="12"
            fill="url(#db-orange-grad)"
          />
        </g>
        <g mask="url(#db-mask-2)">
          <circle
            className="database db-light-2"
            cx="0"
            cy="0"
            r="12"
            fill="url(#db-orange-grad)"
          />
        </g>
        <g mask="url(#db-mask-3)">
          <circle
            className="database db-light-3"
            cx="0"
            cy="0"
            r="12"
            fill="url(#db-orange-grad)"
          />
        </g>
        <g mask="url(#db-mask-4)">
          <circle
            className="database db-light-4"
            cx="0"
            cy="0"
            r="12"
            fill="url(#db-orange-grad)"
          />
        </g>
        {/* Buttons */}
        <g fill="none" strokeWidth="0.4">
          {/* First Button */}
          <g>
            <rect
              fill="white"
              stroke="#e5e7eb"
              x="8"
              y="5"
              width="46"
              height="10"
              rx="5"
            ></rect>
            <DatabaseIcon x="12" y="7.5" color="#FF5C02"></DatabaseIcon>
            <text
              x="21"
              y="12"
              fill="#1f2937"
              stroke="none"
              fontSize="4.5"
              fontWeight="600"
            >
              {badgeTexts?.first || "Shopify"}
            </text>
          </g>
          {/* Second Button */}
          <g>
            <rect
              fill="white"
              stroke="#e5e7eb"
              x="58"
              y="5"
              width="40"
              height="10"
              rx="5"
            ></rect>
            <DatabaseIcon x="62" y="7.5" color="#FF5C02"></DatabaseIcon>
            <text
              x="71"
              y="12"
              fill="#1f2937"
              stroke="none"
              fontSize="4.5"
              fontWeight="600"
            >
              {badgeTexts?.second || "Talleres"}
            </text>
          </g>
          {/* Third Button */}
          <g>
            <rect
              fill="white"
              stroke="#e5e7eb"
              x="104"
              y="5"
              width="42"
              height="10"
              rx="5"
            ></rect>
            <DatabaseIcon x="108" y="7.5" color="#FF5C02"></DatabaseIcon>
            <text
              x="117"
              y="12"
              fill="#1f2937"
              stroke="none"
              fontSize="4.5"
              fontWeight="600"
            >
              {badgeTexts?.third || "Insumos"}
            </text>
          </g>
          {/* Fourth Button */}
          <g>
            <rect
              fill="white"
              stroke="#e5e7eb"
              x="150"
              y="5"
              width="44"
              height="10"
              rx="5"
            ></rect>
            <DatabaseIcon x="154" y="7.5" color="#FF5C02"></DatabaseIcon>
            <text
              x="163"
              y="12"
              fill="#1f2937"
              stroke="none"
              fontSize="4.5"
              fontWeight="600"
            >
              {badgeTexts?.fourth || "Entregas"}
            </text>
          </g>
        </g>
        <defs>
          <mask id="db-mask-1">
            <path
              d="M 31 10 v 15 q 0 5 5 5 h 59 q 5 0 5 5 v 10"
              strokeWidth="0.5"
              stroke="white"
            />
          </mask>
          <mask id="db-mask-2">
            <path
              d="M 77 10 v 10 q 0 5 5 5 h 13 q 5 0 5 5 v 10"
              strokeWidth="0.5"
              stroke="white"
            />
          </mask>
          <mask id="db-mask-3">
            <path
              d="M 124 10 v 10 q 0 5 -5 5 h -14 q -5 0 -5 5 v 10"
              strokeWidth="0.5"
              stroke="white"
            />
          </mask>
          <mask id="db-mask-4">
            <path
              d="M 170 10 v 15 q 0 5 -5 5 h -60 q -5 0 -5 5 v 10"
              strokeWidth="0.5"
              stroke="white"
            />
          </mask>
          <radialGradient id="db-orange-grad" fx="1">
            <stop offset="0%" stopColor={lightColor || "#FF5C02"} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
      </svg>
      {/* Main Box */}
      <div className="absolute bottom-4 sm:bottom-10 flex w-full flex-col items-center">
        {/* bottom shadow */}
        <div className="absolute -bottom-4 h-[60px] sm:h-[100px] w-[62%] rounded-lg bg-orange-100/50" />
        {/* box title */}
        <div className="absolute -top-3 z-20 flex items-center justify-center rounded-lg border border-orange-200 bg-white px-2 py-1 sm:-top-4 sm:py-1.5 shadow-sm">
          <SparklesIcon className="size-3 text-[#FF5C02]" />
          <span className="ml-2 text-[10px] text-gray-700 font-medium">
            {title ? title : "Todos tus datos, una sola plataforma"}
          </span>
        </div>
        {/* box outter circle */}
        <div className="absolute -bottom-6 sm:-bottom-8 z-30 grid h-[45px] w-[45px] sm:h-[60px] sm:w-[60px] place-items-center rounded-full border-t border-orange-200 bg-white font-semibold text-[10px] sm:text-xs text-[#FF5C02] shadow-sm">
          {circleText || "Sewdle"}
        </div>
        {/* box content */}
        <div className="relative z-10 flex h-[100px] sm:h-[150px] w-full items-center justify-center overflow-hidden rounded-lg border border-orange-200/60 bg-white shadow-md">
          {/* Badges */}
          <div className="absolute bottom-8 left-12 z-10 h-7 rounded-full bg-white px-3 text-xs border border-orange-200 flex items-center gap-2 text-gray-700 shadow-sm">
            <HeartHandshakeIcon className="size-4 text-[#FF5C02]" />
            <span className="font-medium">{buttonTexts?.first || "Operaciones"}</span>
          </div>
          <div className="absolute right-16 z-10 hidden h-7 rounded-full bg-white px-3 text-xs sm:flex border border-orange-200 items-center gap-2 text-gray-700 shadow-sm">
            <Folder className="size-4 text-[#FF5C02]" />
            <span className="font-medium">{buttonTexts?.second || "Decisiones"}</span>
          </div>
          {/* Circles */}
          <motion.div
            className="absolute -bottom-14 h-[100px] w-[100px] rounded-full border-t border-orange-200/40 bg-orange-50/30"
            animate={{
              scale: [0.98, 1.02, 0.98, 1, 1, 1, 1, 1, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-20 h-[145px] w-[145px] rounded-full border-t border-orange-200/30 bg-orange-50/20"
            animate={{
              scale: [1, 1, 1, 0.98, 1.02, 0.98, 1, 1, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-[100px] h-[190px] w-[190px] rounded-full border-t border-orange-200/20 bg-orange-50/10"
            animate={{
              scale: [1, 1, 1, 1, 1, 0.98, 1.02, 0.98, 1, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-[120px] h-[235px] w-[235px] rounded-full border-t border-orange-100/20 bg-orange-50/5"
            animate={{
              scale: [1, 1, 1, 1, 1, 1, 0.98, 1.02, 0.98, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
};

export default DatabaseWithRestApi;

const DatabaseIcon = ({ x = "0", y = "0", color = "white" }: { x: string; y: string; color?: string }) => {
  return (
    <svg
      x={x}
      y={y}
      xmlns="http://www.w3.org/2000/svg"
      width="5"
      height="5"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
};
