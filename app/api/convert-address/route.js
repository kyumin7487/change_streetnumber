export async function POST(request) {
    try {
        const { address, apiKey } = await request.json();

        if (!apiKey) {
            return Response.json({ error: 'API 키가 필요합니다' }, { status: 400 });
        }

        // 주소 검색 API 호출
        const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
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
            const keywordResponse = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`, {
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
                roadAddress: `${address} (변환 실패)`,
                jibunAddress: `${address} (변환 실패)`
            });
        }
    } catch (error) {
        console.error('주소 변환 오류:', error);
        return Response.json({
            success: false,
            error: error.message,
            roadAddress: `오류: ${address}`,
            jibunAddress: `오류: ${address}`
        }, { status: 500 });
    }
}