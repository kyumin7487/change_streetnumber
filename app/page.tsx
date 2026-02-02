"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';

const AddressConverter = () => {
    // 타입 오류 방지를 위해 제네릭(<any>)이나 초기값 설정
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState<any[]>([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [columns, setColumns] = useState<any[]>([]);
    const [apiKey, setApiKey] = useState('');

    // GitHub Pages는 정적 사이트라 API Route가 없으므로 기본값을 false로 변경
    const [useProxy, setUseProxy] = useState(false);
    const [progress, setProgress] = useState(0);

    const convertAddress = async (address: string) => {
        try {
            if (!apiKey) {
                throw new Error('카카오 API 키가 설정되지 않았습니다');
            }

            // 직접 호출 (GitHub Pages용)
            const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
                headers: { 'Authorization': `KakaoAK ${apiKey}` }
            });

            if (!response.ok) {
                throw new Error(`카카오 API 에러: ${response.status}`);
            }

            const result = await response.json();

            if (result.documents && result.documents.length > 0) {
                const doc = result.documents[0];

                // 1. 도로명 주소 조립
                let roadAddressShort = '변환실패';
                if (doc.road_address) {
                    const roadName = doc.road_address.road_name || ''; // 없으면 빈문자열
                    const mainNo = doc.road_address.main_building_no || '';
                    const subNo = doc.road_address.sub_building_no || '';

                    if (roadName && mainNo) {
                        roadAddressShort = `${roadName} ${mainNo}`;
                        if (subNo && subNo !== '' && subNo !== '0') {
                            roadAddressShort += `-${subNo}`;
                        }
                    }
                }

                // 2. 지번 주소 조립
                let jibunAddressShort = '변환실패';
                if (doc.address) {
                    const dongName = doc.address.region_3depth_name || '';
                    const mainNo = doc.address.main_address_no || '';
                    const subNo = doc.address.sub_address_no || '';

                    if (dongName && mainNo) {
                        jibunAddressShort = `${dongName} ${mainNo}`;
                        if (subNo && subNo !== '' && subNo !== '0') {
                            jibunAddressShort += `-${subNo}`;
                        }
                    }
                }

                return {
                    roadAddress: roadAddressShort,
                    jibunAddress: jibunAddressShort
                };

            } else {
                return {
                    roadAddress: `변환실패`,
                    jibunAddress: `변환실패`
                };
            }

        } catch (error: any) {
            console.error('주소 변환 오류:', error.message);
            return { roadAddress: `변환실패`, jibunAddress: `변환실패` };
        }
    };

    const handleFileUpload = (event: any) => {
        const uploadedFile = event.target.files[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        const reader = new FileReader();

        reader.onload = (e: any) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length > 0) {
                    const headerRow = jsonData[0] as any[];
                    setColumns(headerRow);
                    setData(jsonData);
                    // 파일 새로 올리면 선택된 컬럼 초기화
                    setSelectedColumn('');
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

        // 헤더 추가
        const firstRow = data[0] as any[];
        const headerRow = [...firstRow, '도로명(상세)', '지번(상세)'];
        newData.push(headerRow);

        for (let i = 1; i < data.length; i++) {
            const row = data[i] as any[];
            const address = row[columnIndex];

            if (address && typeof address === 'string') {
                const convertedAddresses = await convertAddress(address);
                const newRow = [...row, convertedAddresses.roadAddress, convertedAddresses.jibunAddress];
                newData.push(newRow);
            } else {
                const newRow = [...row, '주소없음', '주소없음'];
                newData.push(newRow);
            }

            setProgress(Math.round((i / (data.length - 1)) * 100));
            // API 호출 속도 조절
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        setProcessedData(newData);
        setIsProcessing(false);
    };

    const downloadExcel = () => {
        if (!processedData.length || !file) return;

        const worksheet = XLSX.utils.aoa_to_sheet(processedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '변환된주소');

        const fileName = file.name.replace(/\.(xlsx|xlsm)$/, '_변환됨.xlsx');
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">엑셀 주소 변환기 (간편 주소)</h1>
                <p className="text-gray-600">주소를 변환하여 <b>도로명+번호</b> 및 <b>동+번지</b> 형식으로 출력합니다.</p>
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
                            {columns.map((column: any, index: number) => (
                                <option key={index} value={column}>
                                    {column || `컬럼 ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 여기가 미리보기 복구된 부분입니다 */}
                    {selectedColumn && (
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">선택한 컬럼 데이터 미리보기 (상위 30개):</h4>
                            <div className="bg-gray-50 p-3 rounded border text-sm">
                                {data.slice(1, 31).map((row: any[], index: number) => {
                                    const columnIndex = columns.indexOf(selectedColumn);
                                    return (
                                        <div key={index} className="mb-1 text-gray-600">
                                            <span className="font-semibold text-gray-400 mr-2">{index + 1}.</span>
                                            {row[columnIndex] || '(비어있음)'}
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
                                {processedData[0]?.map((header: any, index: number) => (
                                    <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {processedData.slice(1, 6).map((row: any[], index: number) => (
                                <tr key={index}>
                                    {row.map((cell: any, cellIndex: number) => (
                                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddressConverter;