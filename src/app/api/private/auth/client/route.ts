import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/app/backend/utils/db-connect';
import { ApiClientService } from '@/app/backend/services/api-client.service';

/**
 * Registers a new API Client keypair.
 * POST /api/private/auth/client
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, allowedDomains, allowedIps } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing name parameter' },
        { status: 400 }
      );
    }

    // Create API Client directly at root
    const result = await ApiClientService.createApiClient(
      name,
      allowedDomains || [],
      allowedIps || []
    );

    return NextResponse.json(
      {
        message: 'API client registered successfully',
        clientId: result.client._id,
        apiKey: result.client.apiKey,
        clientSecret: result.plaintextSecret, // plaintext client secret shown ONLY ONCE
        rateLimit: result.client.rateLimit,
        burstLimit: result.client.burstLimit,
        dailyLimit: result.client.dailyLimit,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Failed to create api client route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
