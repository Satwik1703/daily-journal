"use client";

import dynamic from "next/dynamic";
import type { Body3DProps } from "./Body3D";

export type { Body3DProps };

// SSR off — three.js touches window.
export const Body3DDynamic = dynamic(() => import("./Body3D"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full animate-pulse rounded-md bg-muted/30"
      style={{ height: 260 }}
    />
  ),
});
