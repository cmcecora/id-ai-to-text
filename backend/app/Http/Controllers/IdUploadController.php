<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use App\Jobs\IdOcrJob;

class IdUploadController extends Controller
{
    /**
     * Upload and process ID document
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validator = Validator::make($request->all(), [
                'document' => [
                    'required',
                    'file',
                    'mimes:jpg,jpeg,png,pdf,heic',
                    'max:10240', // 10MB
                ]
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => $validator->errors()->first()
                ], 422);
            }

            $file = $request->file('document');
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthenticated'
                ], 401);
            }

            // Store file in storage/app/uploads
            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $filename = uniqid('id_doc_', true) . '.' . $extension;

            $filePath = $file->storeAs('uploads', $filename, 'app');

            // Convert HEIC to JPEG if needed
            if ($extension === 'heic') {
                $filePath = $this->convertHeicToJpeg($filePath, $filename);
            }

            // Dispatch OCR job
            $jobId = uniqid('ocr_', true);
            $ocrJob = new IdOcrJob($filePath, $user->id, $jobId);

            dispatch($ocrJob);

            return response()->json([
                'success' => true,
                'data' => [
                    'job_id' => $jobId,
                    'file_path' => $filePath,
                    'original_name' => $originalName,
                    'file_size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                    'message' => 'File uploaded successfully. OCR processing started.'
                ]
            ]);

        } catch (\Exception $e) {
            // Log error
            \Log::error('ID Upload Error: ' . $e->getMessage(), [
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Upload failed. Please try again.'
            ], 500);
        }
    }

    /**
     * Get OCR job status
     *
     * @param string $jobId
     * @return JsonResponse
     */
    public function getStatus(string $jobId): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthenticated'
                ], 401);
            }

            // Check job status in cache or database
            $jobStatus = $this->getJobStatus($jobId, $user->id);

            if (!$jobStatus) {
                return response()->json([
                    'success' => false,
                    'error' => 'Job not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $jobStatus
            ]);

        } catch (\Exception $e) {
            \Log::error('Job Status Error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Failed to get job status'
            ], 500);
        }
    }

    /**
     * Get OCR results
     *
     * @param string $jobId
     * @return JsonResponse
     */
    public function getResults(string $jobId): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'error' => 'Unauthenticated'
                ], 401);
            }

            // Get results from database
            $results = $this->getJobResults($jobId, $user->id);

            if (!$results) {
                return response()->json([
                    'success' => false,
                    'error' => 'Results not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $results
            ]);

        } catch (\Exception $e) {
            \Log::error('Job Results Error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'error' => 'Failed to get job results'
            ], 500);
        }
    }

    /**
     * Convert HEIC file to JPEG
     *
     * @param string $filePath
     * @param string $filename
     * @return string
     */
    private function convertHeicToJpeg(string $filePath, string $filename): string
    {
        try {
            $heicPath = Storage::disk('app')->path($filePath);
            $jpegFilename = str_replace('.heic', '.jpg', $filename);
            $jpegPath = Storage::disk('app')->path('uploads/' . $jpegFilename);

            // Use heic-convert library
            $imageData = file_get_contents($heicPath);
            $jpegData = \HeicConvert::getInstance()->convert($imageData);

            file_put_contents($jpegPath, $jpegData);

            // Delete original HEIC file
            Storage::disk('app')->delete($filePath);

            return 'uploads/' . $jpegFilename;

        } catch (\Exception $e) {
            \Log::error('HEIC Conversion Error: ' . $e->getMessage());
            throw new \Exception('Failed to convert HEIC file to JPEG');
        }
    }

    /**
     * Get job status from cache/database
     *
     * @param string $jobId
     * @param int $userId
     * @return array|null
     */
    private function getJobStatus(string $jobId, int $userId): ?array
    {
        // Implementation would check Redis cache or database
        // For now, return mock status
        return [
            'job_id' => $jobId,
            'status' => 'processing', // pending, processing, completed, failed
            'progress' => 50,
            'created_at' => now()->toISOString(),
            'updated_at' => now()->toISOString()
        ];
    }

    /**
     * Get job results from database
     *
     * @param string $jobId
     * @param int $userId
     * @return array|null
     */
    private function getJobResults(string $jobId, int $userId): ?array
    {
        // Implementation would query MongoDB for results
        // For now, return mock results
        return [
            'job_id' => $jobId,
            'status' => 'completed',
            'extracted_data' => [
                'lastName' => 'DOE',
                'firstName' => 'JOHN',
                'middleInitial' => 'A',
                'addressStreet' => '123 MAIN ST',
                'addressCity' => 'NEW YORK',
                'addressState' => 'NY',
                'addressZip' => '10001',
                'sex' => 'M',
                'dob' => '1990-01-15'
            ],
            'confidence_score' => 0.95,
            'processed_at' => now()->toISOString()
        ];
    }
}