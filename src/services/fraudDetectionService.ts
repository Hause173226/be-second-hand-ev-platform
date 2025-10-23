// src/services/fraudDetectionService.ts
import { Types } from "mongoose";

export interface FraudDetectionResult {
    isFraud: boolean;
    riskScore: number;
    reasons: string[];
    recommendations: string[];
}

export class FraudDetectionService {
    // Check for suspicious patterns in offers
    static async checkOfferFraud(offerData: {
        offeredPrice: number;
        listingPrice: number;
        buyerId: Types.ObjectId;
        sellerId: Types.ObjectId;
        message?: string;
    }): Promise<FraudDetectionResult> {
        const reasons: string[] = [];
        const recommendations: string[] = [];
        let riskScore = 0;

        // Price analysis
        const priceDifference = Math.abs(offerData.offeredPrice - offerData.listingPrice);
        const pricePercentage = (priceDifference / offerData.listingPrice) * 100;

        // Very low offer (more than 50% below listing price)
        if (offerData.offeredPrice < offerData.listingPrice * 0.5) {
            riskScore += 30;
            reasons.push("Offer is significantly below listing price");
            recommendations.push("Verify buyer's genuine interest");
        }

        // Suspiciously high offer (more than 20% above listing price)
        if (offerData.offeredPrice > offerData.listingPrice * 1.2) {
            riskScore += 25;
            reasons.push("Offer is significantly above listing price");
            recommendations.push("Verify buyer's financial capability");
        }

        // Message analysis
        if (offerData.message) {
            const message = offerData.message.toLowerCase();

            // Common scam phrases
            const scamPhrases = [
                "urgent",
                "asap",
                "wire transfer",
                "western union",
                "moneygram",
                "gift card",
                "cryptocurrency",
                "bitcoin",
                "ethereum",
                "can't meet in person",
                "shipping only",
                "no inspection needed"
            ];

            const foundScamPhrases = scamPhrases.filter(phrase => message.includes(phrase));
            if (foundScamPhrases.length > 0) {
                riskScore += foundScamPhrases.length * 15;
                reasons.push(`Suspicious phrases detected: ${foundScamPhrases.join(", ")}`);
                recommendations.push("Review message content carefully");
            }

            // Very short or generic messages
            if (message.length < 10) {
                riskScore += 10;
                reasons.push("Very short offer message");
                recommendations.push("Request more detailed communication");
            }
        }

        // Check for rapid successive offers (would need to query database)
        // This is a placeholder - in real implementation, you'd check recent offers
        const rapidOffers = await this.checkRapidOffers(offerData.buyerId);
        if (rapidOffers) {
            riskScore += 20;
            reasons.push("Multiple rapid offers detected");
            recommendations.push("Verify buyer's genuine interest");
        }

        // Check for self-offers (buyer and seller are the same)
        if (offerData.buyerId.equals(offerData.sellerId)) {
            riskScore += 50;
            reasons.push("Self-offer detected");
            recommendations.push("Block this offer immediately");
        }

        const isFraud = riskScore >= 50;

        return {
            isFraud,
            riskScore,
            reasons,
            recommendations,
        };
    }

    // Check for suspicious chat patterns
    static async checkChatFraud(chatData: {
        messageContent: string;
        senderId: Types.ObjectId;
        messageType: string;
    }): Promise<FraudDetectionResult> {
        const reasons: string[] = [];
        const recommendations: string[] = [];
        let riskScore = 0;

        const message = chatData.messageContent.toLowerCase();

        // Check for spam patterns
        const spamPatterns = [
            /(.)\1{4,}/g, // Repeated characters
            /https?:\/\/[^\s]+/g, // URLs
            /[0-9]{10,}/g, // Long number sequences
        ];

        for (const pattern of spamPatterns) {
            if (pattern.test(message)) {
                riskScore += 15;
                reasons.push("Spam pattern detected");
                recommendations.push("Review message content");
            }
        }

        // Check for inappropriate content
        const inappropriateWords = [
            "scam", "fraud", "fake", "cheat", "steal", "rob"
        ];

        const foundInappropriate = inappropriateWords.filter(word => message.includes(word));
        if (foundInappropriate.length > 0) {
            riskScore += 25;
            reasons.push("Inappropriate content detected");
            recommendations.push("Moderate this conversation");
        }

        // Check for external contact requests
        const contactPatterns = [
            /contact me at/i,
            /call me at/i,
            /whatsapp/i,
            /telegram/i,
            /viber/i,
            /zalo/i,
        ];

        const foundContactPatterns = contactPatterns.filter(pattern => pattern.test(message));
        if (foundContactPatterns.length > 0) {
            riskScore += 20;
            reasons.push("External contact request detected");
            recommendations.push("Remind users to stay on platform");
        }

        const isFraud = riskScore >= 30;

        return {
            isFraud,
            riskScore,
            reasons,
            recommendations,
        };
    }

    // Check for suspicious appointment patterns
    static async checkAppointmentFraud(appointmentData: {
        scheduledDate: Date;
        location: any;
        buyerId: Types.ObjectId;
        sellerId: Types.ObjectId;
    }): Promise<FraudDetectionResult> {
        const reasons: string[] = [];
        const recommendations: string[] = [];
        let riskScore = 0;

        // Check for very short notice appointments
        const now = new Date();
        const timeDiff = appointmentData.scheduledDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff < 2) {
            riskScore += 15;
            reasons.push("Very short notice appointment");
            recommendations.push("Verify appointment legitimacy");
        }

        // Check for suspicious locations
        if (appointmentData.location) {
            const address = appointmentData.location.address?.toLowerCase() || "";

            const suspiciousLocations = [
                "parking lot",
                "gas station",
                "highway",
                "remote",
                "isolated"
            ];

            const foundSuspicious = suspiciousLocations.filter(loc => address.includes(loc));
            if (foundSuspicious.length > 0) {
                riskScore += 20;
                reasons.push("Suspicious meeting location");
                recommendations.push("Suggest safer meeting location");
            }
        }

        // Check for self-appointments
        if (appointmentData.buyerId.equals(appointmentData.sellerId)) {
            riskScore += 50;
            reasons.push("Self-appointment detected");
            recommendations.push("Block this appointment");
        }

        const isFraud = riskScore >= 30;

        return {
            isFraud,
            riskScore,
            reasons,
            recommendations,
        };
    }

    // Placeholder for checking rapid offers
    private static async checkRapidOffers(buyerId: Types.ObjectId): Promise<boolean> {
        // In real implementation, query database for recent offers by this buyer
        // Return true if more than 3 offers in last hour
        return false;
    }

    // Generate fraud warning message
    static generateFraudWarning(result: FraudDetectionResult): string {
        if (!result.isFraud) return "";

        let warning = "⚠️ FRAUD WARNING ⚠️\n\n";
        warning += "This activity has been flagged as potentially fraudulent:\n\n";

        if (result.reasons.length > 0) {
            warning += "Reasons:\n";
            result.reasons.forEach(reason => warning += `• ${reason}\n`);
            warning += "\n";
        }

        if (result.recommendations.length > 0) {
            warning += "Recommendations:\n";
            result.recommendations.forEach(rec => warning += `• ${rec}\n`);
        }

        warning += `\nRisk Score: ${result.riskScore}/100`;

        return warning;
    }
}
