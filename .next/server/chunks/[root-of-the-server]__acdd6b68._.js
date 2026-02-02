module.exports = [
"[project]/.next-internal/server/app/api/convert-address/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/api/convert-address/route.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
async function POST(request) {
    try {
        const { address: address1, apiKey } = await request.json();
        if (!apiKey) {
            return Response.json({
                error: 'API 키가 필요합니다'
            }, {
                status: 400
            });
        }
        // 주소 검색 API 호출
        const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address1)}`, {
            headers: {
                'Authorization': `KakaoAK ${apiKey}`
            }
        });
        if (!response.ok) {
            throw new Error(`카카오 API 오류: ${response.status}`);
        }
        const result = await response.json();
        if (result.documents && result.documents.length > 0) {
            const doc = result.documents[0];
            return Response.json({
                success: true,
                roadAddress: doc.road_address ? doc.road_address.address_name : '도로명주소 없음',
                jibunAddress: doc.address ? doc.address.address_name : '지번주소 없음'
            });
        } else {
            // 키워드 검색으로 재시도
            const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address1)}`, {
                headers: {
                    'Authorization': `KakaoAK ${apiKey}`
                }
            });
            if (keywordResponse.ok) {
                const keywordResult = await keywordResponse.json();
                if (keywordResult.documents && keywordResult.documents.length > 0) {
                    const doc = keywordResult.documents[0];
                    return Response.json({
                        success: true,
                        roadAddress: doc.road_address_name || '도로명주소 없음',
                        jibunAddress: doc.address_name || '지번주소 없음'
                    });
                }
            }
            return Response.json({
                success: false,
                roadAddress: `${address1} (변환 실패)`,
                jibunAddress: `${address1} (변환 실패)`
            });
        }
    } catch (error) {
        console.error('주소 변환 오류:', error);
        return Response.json({
            success: false,
            error: error.message,
            roadAddress: `오류: ${address}`,
            jibunAddress: `오류: ${address}`
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__acdd6b68._.js.map