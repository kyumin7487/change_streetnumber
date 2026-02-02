"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

const AddressConverter = () => {
    const [file, setFile] = useState(null);
    const [data, setData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [columns, setColumns] = useState([]);
    const [apiKey, setApiKey] = useState('');
    const [useProxy, setUseProxy] = useState(true);
    const [progress, setProgress] = useState(0); // 진행률 상태 추가

    const convertAddress = async (address) => {
        try {
            if (!apiKey) {
                throw new Error('카카오 API 키가 설정되지 않았습니다');
            }

            if (useProxy) {
                const response = await fetch('/api/convert-address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address, apiKey })
                });

                if (!response.ok) {
                    throw new Error(`HTTP 에러: ${response.status}`);
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('API Route를 찾을 수 없습니다. 직접 호출 모드로 전환합니다.');
                }

                const result = await response.json();
                if (result.success) {
                    return {
                        roadAddress: result.roadAddress,
                        jibunAddress: result.jibunAddress
                    };
                } else {
                    return {
                        roadAddress: result.roadAddress || `${address} (변환 실패)`,
                        jibunAddress: result.jibunAddress || `${address} (변환 실패)`
                    };
                }
            } else {
                const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
                    headers: { 'Authorization': `KakaoAK ${apiKey}` }
                });

                if (!response.ok) {
                    throw new Error(`카카오 API 에러: ${response.status}`);
                }

                const result = await response.json();
                if (result.documents && result.documents.length > 0) {
                    const doc = result.documents[0];
                    return {
                        roadAddress: doc.road_address ? doc.road_address.address_name : '도로명주소 없음',
                        jibunAddress: doc.address ? doc.address.address_name : '지번주소 없음'
                    };
                } else {
                    return {
                        roadAddress: `${address} (변환 실패)`,
                        jibunAddress: `${address} (변환 실패)`
                    };
                }
            }
        } catch (error) {
            console.error('주소 변환 오류:', error.message);
            if (useProxy && error.message.includes('API Route')) {
                setUseProxy(false);
                alert('API Route를 찾을 수 없어 직접 호출 모드로 전환합니다. CORS 에러가 발생할 수 있습니다.');
                return convertAddress(address);
            }
            return { roadAddress: `오류: ${error.message}`, jibunAddress: `오류: ${error.message}` };
        }
    };

    const handleFileUpload = (event) => {
        const uploadedFile = event.target.files[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length > 0) {
                    const headerRow = jsonData[0];
                    setColumns(headerRow);
                    setData(jsonData);
                }
            } catch (error) {
                alert('엑셀 파일을 읽는 중 오류가 발생했습니다.');
            }
        };

        reader.readAsBinaryString(uploadedFile);
    };

    const processAddresses = async () => {
        if (!selectedColumn || !data.length) {
            alert('파일과 주소 컬럼을 선택해주세요.');
            return;
        }
        if (!apiKey) {
            alert('카카오 API 키를 입력해주세요.');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        const columnIndex = columns.indexOf(selectedColumn);
        const newData = [];

        const headerRow = [...data[0], '도로명주소', '지번주소'];
        newData.push(headerRow);

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const address = row[columnIndex];

            if (address && typeof address === 'string') {
                const convertedAddresses = await convertAddress(address);
                const newRow = [...row, convertedAddresses.roadAddress, convertedAddresses.jibunAddress];
                newData.push(newRow);
            } else {
                const newRow = [...row, '주소 없음', '주소 없음'];
                newData.push(newRow);
            }

            setProgress(Math.round((i / (data.length - 1)) * 100));
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        setProcessedData(newData);
        setIsProcessing(false);
    };

    const downloadExcel = () => {
        if (!processedData.length) return;

        const worksheet = XLSX.utils.aoa_to_sheet(processedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '변환된주소');

        const fileName = file.name.replace(/\.(xlsx|xlsm)$/, '_변환됨.xlsx');
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">엑셀 주소 변환기</h1>
                <p className="text-gray-600">엑셀 파일의 주소를 도로명주소와 지번주소로 변환합니다</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">카카오 API 키 설정</h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        카카오 REST API 키:
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="카카오 REST API 키를 입력하세요"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="mb-4">
                    <label className="flex items-center">
                        <input
                            type="checkbox"
                            checked={useProxy}
                            onChange={(e) => setUseProxy(e.target.checked)}
                            className="mr-2"
                        />
                        <span className="text-sm text-gray-700">API Route 사용 (권장)</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">체크 해제시 직접 호출 (CORS 에러 가능)</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-2" />
                    <div>
                        <h4 className="text-sm font-medium text-blue-800">API 키 발급 방법</h4>
                        <p className="text-sm text-blue-700 mt-1">
                            <strong>1단계:</strong> <a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" className="underline">카카오 개발자센터</a>에서 앱 생성
                            <br />
                            <strong>2단계:</strong> "플랫폼" → "Web 플랫폼" 추가 → 도메인 등록 (예: http://localhost:3000)
                            <br />
                            <strong>3단계:</strong> "앱 키" → "REST API 키" 복사하여 위에 입력
                            <br />
                            <strong>주의:</strong> API Route를 통해 CORS 이슈를 해결했습니다.
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <label className="cursor-pointer">
                        <span className="text-lg font-medium text-gray-900">엑셀 파일을 선택하세요</span>
                        <input
                            type="file"
                            accept=".xlsx,.xlsm"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </label>
                    <p className="text-sm text-gray-500 mt-2">XLSX, XLSM 파일을 지원합니다</p>
                </div>
            </div>

            {file && data.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">파일 정보</h3>
                    <p className="text-sm text-gray-600 mb-4">
                        파일명: {file.name} | 총 {data.length - 1}행의 데이터
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            주소가 있는 컬럼을 선택하세요:
                        </label>
                        <select
                            value={selectedColumn}
                            onChange={(e) => setSelectedColumn(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">컬럼 선택...</option>
                            {columns.map((column, index) => (
                                <option key={index} value={column}>
                                    {column || `컬럼 ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedColumn && (
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">데이터 미리보기:</h4>
                            <div className="bg-gray-50 p-3 rounded border text-sm">
                                {data.slice(1, 4).map((row, index) => {
                                    const columnIndex = columns.indexOf(selectedColumn);
                                    return (
                                        <div key={index} className="mb-1">
                                            {index + 1}행: {row[columnIndex] || '데이터 없음'}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedColumn && apiKey && (
                <div className="text-center">
                    <button
                        onClick={processAddresses}
                        disabled={isProcessing}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                변환 중... {progress}%
                            </>
                        ) : (
                            '주소 변환 시작'
                        )}
                    </button>
                </div>
            )}

            {processedData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                            <h3 className="text-lg font-semibold">변환 완료</h3>
                        </div>
                        <button
                            onClick={downloadExcel}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            다운로드
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                {processedData[0]?.map((header, index) => (
                                    <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {processedData.slice(1, 6).map((row, index) => (
                                <tr key={index}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {processedData.length > 6 && (
                        <p className="text-sm text-gray-500 mt-2">
                            ... 총 {processedData.length - 1}행 (처음 5행만 미리보기)
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddressConverter;