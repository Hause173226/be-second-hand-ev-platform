import axios from "axios";

export interface CCCDScanResult {
  idNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  issuedDate?: string;
  issuedPlace?: string;
  confidence: number;
}

export interface OCRResponse {
  success: boolean;
  data?: CCCDScanResult;
  error?: string;
}

export const ocrService = {
  // Quét CCCD mặt trước
  scanCCCDFront: async (imageUrl: string): Promise<OCRResponse> => {
    try {
      // Giả lập OCR service - trong thực tế sẽ gọi API OCR thật
      // Có thể sử dụng Google Vision API, AWS Textract, hoặc OCR service khác

      const mockResult: CCCDScanResult = {
        idNumber: "001234567890",
        fullName: "NGUYỄN VĂN A",
        dateOfBirth: "01/01/1990",
        gender: "Nam",
        nationality: "Việt Nam",
        placeOfOrigin: "Hà Nội",
        placeOfResidence: "123 Đường ABC, Quận XYZ, Hà Nội",
        issuedDate: "01/01/2020",
        issuedPlace: "Công an TP Hà Nội",
        confidence: 95,
      };

      return {
        success: true,
        data: mockResult,
      };
    } catch (error) {
      return {
        success: false,
        error: "Không thể quét CCCD mặt trước",
      };
    }
  },

  // Quét CCCD mặt sau
  scanCCCDBack: async (imageUrl: string): Promise<OCRResponse> => {
    try {
      // Giả lập OCR service cho mặt sau CCCD
      const mockResult: CCCDScanResult = {
        idNumber: "001234567890",
        fullName: "NGUYỄN VĂN A",
        dateOfBirth: "01/01/1990",
        gender: "Nam",
        nationality: "Việt Nam",
        placeOfOrigin: "Hà Nội",
        placeOfResidence: "123 Đường ABC, Quận XYZ, Hà Nội",
        issuedDate: "01/01/2020",
        issuedPlace: "Công an TP Hà Nội",
        confidence: 90,
      };

      return {
        success: true,
        data: mockResult,
      };
    } catch (error) {
      return {
        success: false,
        error: "Không thể quét CCCD mặt sau",
      };
    }
  },

  // Quét CCCD tự động (cả mặt trước và sau)
  scanCCCD: async (
    frontImageUrl: string,
    backImageUrl?: string
  ): Promise<OCRResponse> => {
    try {
      // Quét mặt trước
      const frontResult = await ocrService.scanCCCDFront(frontImageUrl);

      if (!frontResult.success) {
        return frontResult;
      }

      // Nếu có mặt sau, quét mặt sau để cross-check
      if (backImageUrl) {
        const backResult = await ocrService.scanCCCDBack(backImageUrl);

        if (backResult.success && backResult.data) {
          // Cross-check thông tin giữa mặt trước và sau
          const isValid = ocrService.validateCCCDConsistency(
            frontResult.data!,
            backResult.data
          );

          if (!isValid) {
            return {
              success: false,
              error: "Thông tin CCCD mặt trước và sau không khớp",
            };
          }
        }
      }

      return frontResult;
    } catch (error) {
      return {
        success: false,
        error: "Không thể quét CCCD",
      };
    }
  },

  // Kiểm tra tính nhất quán của thông tin CCCD
  validateCCCDConsistency: (
    frontData: CCCDScanResult,
    backData: CCCDScanResult
  ): boolean => {
    const fieldsToCheck = [
      "idNumber",
      "fullName",
      "dateOfBirth",
      "gender",
      "nationality",
    ];

    for (const field of fieldsToCheck) {
      if (
        frontData[field as keyof CCCDScanResult] !==
        backData[field as keyof CCCDScanResult]
      ) {
        return false;
      }
    }

    return true;
  },

  // Validate định dạng CCCD
  validateCCCDFormat: (
    data: CCCDScanResult
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate số CCCD (12 số)
    if (!data.idNumber || !/^\d{12}$/.test(data.idNumber)) {
      errors.push("Số CCCD phải có 12 chữ số");
    }

    // Validate họ tên
    if (!data.fullName || data.fullName.length < 2) {
      errors.push("Họ tên không hợp lệ");
    }

    // Validate ngày sinh
    if (!data.dateOfBirth || !/^\d{2}\/\d{2}\/\d{4}$/.test(data.dateOfBirth)) {
      errors.push("Ngày sinh phải có định dạng DD/MM/YYYY");
    }

    // Validate giới tính
    if (!data.gender || !["Nam", "Nữ"].includes(data.gender)) {
      errors.push("Giới tính phải là Nam hoặc Nữ");
    }

    // Validate quốc tịch
    if (!data.nationality || data.nationality.length < 2) {
      errors.push("Quốc tịch không hợp lệ");
    }

    // Validate độ tin cậy
    if (data.confidence < 70) {
      errors.push("Độ tin cậy OCR quá thấp (< 70%)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Gọi API OCR thật (ví dụ với Google Vision API)
  callRealOCRService: async (
    imageUrl: string,
    documentType: "front" | "back"
  ): Promise<OCRResponse> => {
    try {
      // Ví dụ với Google Vision API
      const response = await axios.post(
        "https://vision.googleapis.com/v1/images:annotate",
        {
          requests: [
            {
              image: {
                source: {
                  imageUri: imageUrl,
                },
              },
              features: [
                {
                  type: "TEXT_DETECTION",
                  maxResults: 1,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GOOGLE_VISION_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Parse OCR result và extract CCCD information
      const ocrText =
        response.data.responses[0]?.textAnnotations?.[0]?.description || "";
      const parsedData = ocrService.parseCCCDText(ocrText, documentType);

      return {
        success: true,
        data: parsedData,
      };
    } catch (error) {
      return {
        success: false,
        error: "Lỗi khi gọi OCR service",
      };
    }
  },

  // Parse text từ OCR thành structured data
  parseCCCDText: (
    text: string,
    documentType: "front" | "back"
  ): CCCDScanResult => {
    // Logic để parse OCR text thành structured data
    // Đây là logic phức tạp cần được implement dựa trên format của CCCD

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    // Extract các thông tin từ CCCD
    const result: CCCDScanResult = {
      confidence: 85, // Default confidence
    };

    // Parse logic sẽ được implement dựa trên format thực tế của CCCD
    // Ví dụ:
    for (const line of lines) {
      if (line.includes("Số:")) {
        result.idNumber = line.replace("Số:", "").trim();
      }
      if (line.includes("Họ và tên:")) {
        result.fullName = line.replace("Họ và tên:", "").trim();
      }
      // ... các field khác
    }

    return result;
  },
};
