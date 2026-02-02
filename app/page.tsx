"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    Upload, Download, AlertCircle, CheckCircle2,
    FileSpreadsheet, MapPin, ArrowRight, HelpCircle, ShieldAlert, Eye
} from 'lucide-react';

const AddressConverter = () => {
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState<any[]>([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [columns, setColumns] = useState<any[]>([]);
    const [apiKey, setApiKey] = useState('');
    const [progress, setProgress] = useState(0);

    // --- (기존 로직 동일) ---
    const convertAddress = async (address: string) => {
        try {
            if (!apiKey) throw new Error('카카오 API 키가 설정되지 않았습니다');
            const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
                headers: { 'Authorization': `KakaoAK ${apiKey}` }
            });
            if (!response.ok) throw new Error(`카카오 API 에러: ${response.status}`);
            const result = await response.json();

            if (result.documents && result.documents.length > 0) {
                const doc = result.documents[0];
                let roadAddressShort = '변환실패';
                if (doc.road_address) {
                    const roadName = doc.road_address.road_name || '';
                    const mainNo = doc.road_address.main_building_no || '';
                    const subNo = doc.road_address.sub_building_no || '';
                    if (roadName && mainNo) {
                        roadAddressShort = `${roadName} ${mainNo}`;
                        if (subNo && subNo !== '' && subNo !== '0') roadAddressShort += `-${subNo}`;
                    }
                }

                let jibunAddressShort = '변환실패';
                if (doc.address) {
                    let dongName = doc.address.region_3depth_name || '';
                    if (dongName.includes(' ')) {
                        const parts = dongName.split(' ');
                        dongName = parts[parts.length - 1];
                    }
                    const mainNo = doc.address.main_address_no || '';
                    const subNo = doc.address.sub_address_no || '';
                    if (dongName && mainNo) {
                        jibunAddressShort = `${dongName} ${mainNo}`;
                        if (subNo && subNo !== '' && subNo !== '0') jibunAddressShort += `-${subNo}`;
                    }
                }
                return { roadAddress: roadAddressShort, jibunAddress: jibunAddressShort };
            } else {
                return { roadAddress: `변환실패`, jibunAddress: `변환실패` };
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
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        setProcessedData(newData);
        setIsProcessing(false);
    };

    const downloadExcel = async () => {
        if (!processedData.length || !file) return;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('변환된주소');
        processedData.forEach((row) => { worksheet.addRow(row); });

        worksheet.columns.forEach((column, index) => {
            let maxLength = 0;
            const colIndex = index + 1;
            const colLetter = worksheet.getColumn(colIndex);
            colLetter.eachCell({ includeEmpty: true }, (cell) => {
                const cellValue = cell.value ? String(cell.value) : "";
                const length = cellValue.length + (cellValue.replace(/[a-zA-Z0-9]/g, '').length * 0.5);
                if (length > maxLength) maxLength = length;
                if (cellValue === '변환실패' || cellValue === '주소없음') {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
                    cell.font = { color: { argb: 'FF9C0006' }, bold: true };
                }
            });
            colLetter.width = Math.min(Math.max(maxLength + 2, 12), 60);
        });

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
            cell.alignment = { horizontal: 'center' };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = file.name.replace(/\.(xlsx|xlsm)$/, '_변환됨.xlsx');
        saveAs(blob, fileName);
    };
    // --- (로직 끝) ---

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-600 pb-24 pt-12 px-4 sm:px-6 lg:px-8 shadow-lg">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center space-x-3 mb-2">
                        <MapPin className="h-8 w-8 text-blue-200" />
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">
                            엑셀 주소 도로명 & 지번 변환기
                        </h1>
                    </div>
                    <p className="mt-2 text-lg text-blue-100 max-w-2xl">
                        복잡한 주소록을 한 번에 정리하세요. <br/>
                        도로명주소와 지번주소를 자동으로 분리하여 깔끔한 엑셀 파일로 만들어드립니다.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <main className="-mt-20 flex-grow px-4 sm:px-6 lg:px-8 pb-12">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: The Tool (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 1. API Key Card */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center mb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                                        <ShieldAlert className="h-5 w-5 text-blue-600" />
                                    </div>
                                    1. API 설정
                                </h3>
                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        카카오 REST API 키
                                    </label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="API 키를 입력해주세요"
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                    <p className="text-xs text-gray-500">
                                        * 키는 브라우저에만 저장되며 서버로 전송되지 않습니다. 안심하고 사용하세요.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Upload Card */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center mb-6">
                                    <div className="bg-green-100 p-2 rounded-lg mr-3">
                                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                                    </div>
                                    2. 파일 업로드
                                </h3>

                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer group relative">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xlsm"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="space-y-2">
                                        <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                            <Upload className="h-8 w-8 text-blue-600" />
                                        </div>
                                        <div className="text-gray-600 font-medium">
                                            클릭하여 엑셀 파일 업로드
                                        </div>
                                        <p className="text-xs text-gray-400">XLSX, XLSM 포맷 지원</p>
                                    </div>
                                </div>

                                {file && (
                                    <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200 animate-fade-in">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm font-medium text-gray-700 truncate flex-1">
                                                📄 {file.name}
                                            </span>
                                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                                {data.length - 1}개 데이터
                                            </span>
                                        </div>

                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            변환할 주소 컬럼 선택
                                        </label>
                                        <select
                                            value={selectedColumn}
                                            onChange={(e) => setSelectedColumn(e.target.value)}
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">컬럼을 선택해주세요</option>
                                            {columns.map((col: any, idx) => (
                                                <option key={idx} value={col}>{col || `Column ${idx+1}`}</option>
                                            ))}
                                        </select>

                                        {selectedColumn && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                                                    <Eye className="h-3 w-3 mr-1" /> 선택 데이터 미리보기 (상위 5개)
                                                </h4>
                                                <div className="bg-white p-3 rounded border border-gray-200 space-y-1">
                                                    {data.slice(1, 6).map((row: any[], index: number) => {
                                                        const columnIndex = columns.indexOf(selectedColumn);
                                                        return (
                                                            <div key={index} className="text-sm text-gray-600 truncate flex items-center">
                                                                <span className="inline-block w-6 text-center text-xs font-bold text-blue-500 bg-blue-50 rounded mr-2">{index + 1}</span>
                                                                {row[columnIndex] || <span className="text-gray-400 italic">(비어있음)</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Area */}
                        {selectedColumn && apiKey && (
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={processAddresses}
                                    disabled={isProcessing}
                                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            <span>변환 진행중 ({progress}%)</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>주소 변환 시작하기</span>
                                            <ArrowRight className="h-5 w-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Result Area */}
                        {processedData.length > 0 && (
                            <div className="bg-white rounded-xl shadow-lg border border-green-100 overflow-hidden animate-fade-in-up">
                                <div className="bg-green-50 p-4 border-b border-green-100 flex justify-between items-center">
                                    <div className="flex items-center space-x-2 text-green-800 font-bold">
                                        <CheckCircle2 className="h-6 w-6" />
                                        <span>변환 완료!</span>
                                    </div>
                                    <button
                                        onClick={downloadExcel}
                                        className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>엑셀 다운로드</span>
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                        <tr>
                                            {processedData[0]?.map((h:any, i:number) => (
                                                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                        {processedData.slice(1, 11).map((row:any[], i) => (
                                            <tr key={i}>
                                                {row.map((cell:any, j) => (
                                                    <td key={j} className={`px-6 py-4 whitespace-nowrap text-sm ${cell === '변환실패' || cell === '주소없음' ? 'text-red-600 font-bold bg-red-50' : 'text-gray-700'}`}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 bg-gray-50 text-center text-xs text-gray-500 border-t">
                                    * 미리보기입니다. 전체 데이터는 엑셀을 다운로드하여 확인해주세요!
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Information (Sidebar) */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 space-y-6">

                            {/* Guide Card */}
                            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                    <HelpCircle className="h-5 w-5 text-indigo-500 mr-2" />
                                    사용 방법
                                </h4>
                                <ul className="space-y-4">
                                    <li className="flex">
                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs mr-3">1</span>
                                        <p className="text-sm text-gray-600">
                                            <a href="https://developers.kakao.com" target="_blank" className="text-indigo-600 hover:underline">카카오 개발자 센터</a>에서 REST API 키를 발급받으세요.
                                        </p>
                                    </li>
                                    <li className="flex">
                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs mr-3">2</span>
                                        <p className="text-sm text-gray-600">
                                            엑셀 파일을 업로드하고, 주소가 들어있는 컬럼을 선택합니다.
                                        </p>
                                    </li>
                                    <li className="flex">
                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs mr-3">3</span>
                                        <p className="text-sm text-gray-600">
                                            '변환 시작'을 누르면 <b>도로명(건물번호)</b>와 <b>지번(동+번지)</b> 형식으로 자동 변환됩니다.
                                        </p>
                                    </li>
                                    <li className="flex">
                                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs mr-3">4</span>
                                        <p className="text-sm text-gray-600">
                                            완료 후 다운로드 버튼을 누르면 색상 코드가 포함된 엑셀 파일이 저장됩니다.
                                        </p>
                                    </li>
                                </ul>

                                <div className="mt-8 pt-6 border-t border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-900 mb-2">💡 팁</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        변환에 실패한 주소는 엑셀 파일 내에서 <span className="text-red-600 font-bold bg-red-100 px-1 rounded">빨간색 배경</span>으로 표시되므로 쉽게 구분하여 수정할 수 있습니다!
                                    </p>
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="text-center space-y-2 pt-2 pb-6">
                                <p className="text-xs text-gray-500">
                                    Powered by Kakao Maps API & Next.js
                                </p>
                                <p className="text-xs text-gray-400">
                                    &copy; 2026 Address Converter. All rights reserved.<br />
                                    Made by Park Kyumin for Sumin Kim.
                                </p>
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AddressConverter;