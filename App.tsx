import React, { useState, useEffect } from 'react';
import type { PdfDocument, ImagePayload, QuizQuestion, ConversationTurn, Profile } from './types';
import { usePdfProcessor } from './hooks/usePdfProcessor';
import { getAnswer, generateQuiz } from './services/geminiService';
import FileUpload from './components/FileUpload';
import QuestionInput from './components/QuestionInput';
import AnswerDisplay from './components/AnswerDisplay';
import QuizModal from './components/StudyGuideDisplay';
import ImageAnnotator from './components/ImageAnnotator';
import ProfileEditModal from './components/ProfileEditModal';
import Tooltip from './components/Tooltip';
import { BookIcon, CpuChipIcon, TrashIcon, ClipboardDocumentListIcon, PencilIcon, UserCircleIcon } from './components/icons';

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove "data:mime/type;base64," prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};


const App: React.FC = () => {
    const { processedDocs, processPdfs, isProcessing: isPdfProcessing, error: pdfError, setProcessedDocs, setError: setPdfError } = usePdfProcessor();
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [apiError, setApiError] = useState<string>('');
    const [image, setImage] = useState<ImagePayload | null>(null);
    const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
    const [isAnnotatorOpen, setIsAnnotatorOpen] = useState<boolean>(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
    const [profile, setProfile] = useState<Profile>({ name: 'Alex Johnson', title: 'Student', picture: null });

    const isLoading = isPdfProcessing || isGenerating || isGeneratingQuiz;
    const error = pdfError || apiError;

    const handleFileChange = async (files: FileList | null) => {
        if (files && files.length > 0) {
            // Clear previous session when new files are uploaded
            handleClearSession();
            await processPdfs(files);
        }
    };

    const handleQuestionSubmit = async (question: string) => {
        if (!question.trim() && !image) return;
        
        const newUserTurn: ConversationTurn = { role: 'user', content: question };
        setConversation(prev => [...prev, newUserTurn]);

        setIsGenerating(true);
        setApiError('');

        try {
            const docsContext = processedDocs.map(d => ({ name: d.file.name, text: d.text }));
            const generatedAnswer = await getAnswer(question, docsContext, image);
            const newModelTurn: ConversationTurn = { role: 'model', content: generatedAnswer };
            setConversation(prev => [...prev, newModelTurn]);
        } catch (e) {
            const error = e as Error;
            console.error(error);
            setApiError(error.message || 'An unknown error occurred while generating the answer.');
        } finally {
            setIsGenerating(false);
            // Don't clear image here to allow follow-up questions
        }
    };

    const handleImageSelect = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setApiError("Please select a valid image file.");
            return;
        }
        setApiError('');
        try {
            const base64Data = await fileToBase64(file);
            setImage({
                data: base64Data,
                mimeType: file.type,
                name: file.name,
            });
        } catch (error) {
            console.error("Error converting file to base64:", error);
            setApiError("Failed to load the image. Please try again.");
        }
    };
    
    const handleAnnotateComplete = (newImagePayload: ImagePayload) => {
        setImage(newImagePayload);
        setIsAnnotatorOpen(false);
    };

    const handleGenerateQuiz = async () => {
        if (processedDocs.length === 0) return;

        setIsGeneratingQuiz(true);
        setApiError('');
        setQuiz(null);

        try {
            const combinedText = processedDocs.map(doc => doc.text).join('\n\n---\n\n');
            const questions = await generateQuiz(combinedText);
            setQuiz(questions);
        } catch (e) {
            const error = e as Error;
            console.error(error);
            setApiError(error.message || 'An unknown error occurred while generating the quiz.');
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleClearSession = () => {
        setProcessedDocs([]);
        setConversation([]);
        setApiError('');
        setPdfError(null);
        setImage(null);
        setQuiz(null);
        setIsQuizModalOpen(false);
    };

    const handleProfileSave = (newProfile: Profile) => {
        setProfile(newProfile);
        setIsProfileModalOpen(false);
    };


    return (
        <div className="bg-slate-100 min-h-screen font-sans text-slate-800 flex flex-col">
            <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <BookIcon className="h-8 w-8 text-blue-600" />
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">StudyMate</h1>
                    </div>
                     <div className="flex items-center space-x-4">
                        <a href="https://github.com/google/generative-ai-docs" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-sm text-slate-500 hover:text-blue-600 transition-colors">
                            <CpuChipIcon className="h-5 w-5" />
                            <span>Powered by Gemini API</span>
                        </a>
                     </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                    
                    {/* Left Column */}
                    <aside className="lg:col-span-4 xl:col-span-3">
                        <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-slate-900">Upload Content</h2>
                                {processedDocs.length > 0 && (
                                     <button
                                        onClick={handleClearSession}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full -mr-1"
                                        aria-label="Clear session and remove all documents"
                                        title="Clear Session"
                                     >
                                        <TrashIcon className="h-5 w-5" />
                                     </button>
                                )}
                            </div>
                            <FileUpload 
                                onFileChange={handleFileChange} 
                                isProcessing={isPdfProcessing} 
                                onImageSelect={handleImageSelect}
                                onGenerateQuiz={handleGenerateQuiz}
                                docsLoaded={processedDocs.length > 0}
                            />
                            
                            {processedDocs.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="font-semibold text-slate-900 mb-3">Loaded Documents:</h3>
                                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                        {processedDocs.map(doc => (
                                            <li key={doc.file.name} className="bg-slate-50 text-slate-700 text-sm p-3 rounded-md truncate" title={doc.file.name}>
                                                {doc.file.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Right Column */}
                    <div className="lg:col-span-8 xl:col-span-9">
                        <div className="bg-white rounded-xl shadow-md h-full flex flex-col">
                           <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center space-x-3 group">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0">
                                        {profile.picture ? (
                                            <img src={profile.picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <UserCircleIcon className="w-full h-full text-slate-400" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">{profile.name}</p>
                                        <p className="text-xs text-slate-500">{profile.title}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsProfileModalOpen(true)}
                                        className="p-1 text-slate-400 hover:text-blue-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Edit profile"
                                        title="Edit Profile"
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                {quiz && !isGeneratingQuiz && (
                                    <Tooltip text="View Practice Quiz">
                                        <button
                                            onClick={() => setIsQuizModalOpen(true)}
                                            className="p-2 text-slate-500 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-100"
                                            aria-label="View Practice Quiz"
                                        >
                                            <ClipboardDocumentListIcon className="h-6 w-6" />
                                        </button>
                                    </Tooltip>
                                )}
                            </div>

                           <div className="flex-grow flex flex-col min-h-[calc(100vh-300px)]">
                                <div className="flex-grow overflow-y-auto p-4 sm:p-6">
                                   <AnswerDisplay conversation={conversation} isLoading={isGenerating} error={!isGeneratingQuiz ? apiError || error : null} documents={processedDocs} />
                                </div>
                                <div className="p-4 sm:p-6 border-t border-slate-200">
                                    <QuestionInput
                                      onSubmit={handleQuestionSubmit}
                                      disabled={isLoading}
                                      image={image}
                                      onImageSelect={handleImageSelect}
                                      onClearImage={() => setImage(null)}
                                      onImageClick={() => setIsAnnotatorOpen(true)}
                                      docsLoaded={processedDocs.length > 0}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {isAnnotatorOpen && image && (
                <ImageAnnotator 
                    image={image}
                    onComplete={handleAnnotateComplete}
                    onCancel={() => setIsAnnotatorOpen(false)}
                />
            )}

            {isQuizModalOpen && (
                <QuizModal
                    quiz={quiz}
                    isLoading={isGeneratingQuiz}
                    error={apiError}
                    onClose={() => setIsQuizModalOpen(false)}
                />
            )}

            {isProfileModalOpen && (
                <ProfileEditModal
                    currentProfile={profile}
                    onSave={handleProfileSave}
                    onClose={() => setIsProfileModalOpen(false)}
                />
            )}
        </div>
    );
};

export default App;