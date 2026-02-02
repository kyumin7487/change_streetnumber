import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    output: 'export',

    // 이미지 최적화 끄기
    images: {
        unoptimized: true,
    },
};

export default nextConfig;