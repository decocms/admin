export const GRID_VIEW_TEMPLATE = `
import React from "react";

export const App = () => {
    const [views, setViews] = React.useState([]);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const fetchViews = async () => {
            try {
                // Initial views to load
                // You can add default views here
                const initialViews = [
                    // "view://integration/view-name"
                ];
                
                // Add dynamically added views
                // This array will be updated by the "Add View" button
                const dynamicViews = []; // views = []

                const allViewUris = [...initialViews, ...dynamicViews];
                
                if (allViewUris.length === 0) return;

                const loadedViews = await Promise.all(
                    allViewUris.map(async (uri) => {
                        return new Promise((resolve) => {
                            const requestId = Math.random().toString(36).substring(7);
                            
                            const handleResponse = (event) => {
                                if (event.data.type === "FETCH_VIEW_RESPONSE" && event.data.payload.requestId === requestId) {
                                    window.removeEventListener("message", handleResponse);
                                    if (event.data.payload.error) {
                                        resolve({ uri, error: event.data.payload.error });
                                    } else {
                                        resolve({ uri, html: event.data.payload.html });
                                    }
                                }
                            };
                            
                            window.addEventListener("message", handleResponse);
                            window.postMessage({ type: "FETCH_VIEW", payload: { uri, requestId } }, "*");
                        });
                    })
                );
                
                setViews(loadedViews);
            } catch (err) {
                setError(err.message);
            }
        };
        
        fetchViews();
    }, []);

    if (error) {
        return <div className="p-4 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Grid View</h1>
                <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onClick={() => {
                        window.postMessage({ type: "OPEN_VIEW_PICKER" }, "*");
                    }}
                >
                    Add View
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {views.map((view, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden shadow-sm h-64 bg-white">
                        {view.error ? (
                            <div className="p-4 text-red-500">Failed to load: {view.uri}</div>
                        ) : (
                            <iframe 
                                srcDoc={view.html} 
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            />
                        )}
                    </div>
                ))}
                
                {views.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                        <p className="mb-2">No views added yet</p>
                         <button 
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            onClick={() => {
                                window.postMessage({ type: "OPEN_VIEW_PICKER" }, "*");
                            }}
                        >
                            + Add Another View
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
`;

export const LIST_VIEW_TEMPLATE = `
import React from "react";

export const App = () => {
    const [views, setViews] = React.useState([]);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const fetchViews = async () => {
            try {
                // Initial views to load
                const initialViews = [];
                
                // Add dynamically added views
                const dynamicViews = []; // views = []

                const allViewUris = [...initialViews, ...dynamicViews];
                
                if (allViewUris.length === 0) return;

                const loadedViews = await Promise.all(
                    allViewUris.map(async (uri) => {
                        return new Promise((resolve) => {
                            const requestId = Math.random().toString(36).substring(7);
                            
                            const handleResponse = (event) => {
                                if (event.data.type === "FETCH_VIEW_RESPONSE" && event.data.payload.requestId === requestId) {
                                    window.removeEventListener("message", handleResponse);
                                    if (event.data.payload.error) {
                                        resolve({ uri, error: event.data.payload.error });
                                    } else {
                                        resolve({ uri, html: event.data.payload.html });
                                    }
                                }
                            };
                            
                            window.addEventListener("message", handleResponse);
                            window.postMessage({ type: "FETCH_VIEW", payload: { uri, requestId } }, "*");
                        });
                    })
                );
                
                setViews(loadedViews);
            } catch (err) {
                setError(err.message);
            }
        };
        
        fetchViews();
    }, []);

    if (error) {
        return <div className="p-4 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">List View</h1>
                <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onClick={() => {
                        window.postMessage({ type: "OPEN_VIEW_PICKER" }, "*");
                    }}
                >
                    Add View
                </button>
            </div>
            
            <div className="flex flex-col gap-4">
                {views.map((view, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden shadow-sm h-48 bg-white">
                        {view.error ? (
                            <div className="p-4 text-red-500">Failed to load: {view.uri}</div>
                        ) : (
                            <iframe 
                                srcDoc={view.html} 
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            />
                        )}
                    </div>
                ))}
                
                {views.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
                        <p className="mb-2">No views added yet</p>
                         <button 
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            onClick={() => {
                                window.postMessage({ type: "OPEN_VIEW_PICKER" }, "*");
                            }}
                        >
                            + Add Another View
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
`;
