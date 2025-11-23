import React from "react";

export const App = ({ views = [] }: { views?: string[] }) => {
    const [viewData, setViewData] = React.useState<Record<string, string>>({});
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        if (!views.length) return;

        views.forEach((uri) => {
            // @ts-ignore - fetchView is injected by the SDK
            window.fetchView(uri)
                .then((html: string) => {
                    setViewData((prev) => ({ ...prev, [uri]: html }));
                })
                .catch((err: Error) => {
                    setErrors((prev) => ({ ...prev, [uri]: err.message }));
                });
        });
    }, [views]);

    if (!views.length) {
        return (
            <div className="p-8 text-center text-gray-500">
                <h2 className="text-xl font-semibold mb-2">Empty List</h2>
                <p>No views configured. Add view URIs to the "views" prop.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
            {views.map((uri) => (
                <div key={uri} className="border rounded-lg overflow-hidden shadow-sm bg-white flex flex-col md:flex-row h-64 md:h-48">
                    <div className="bg-gray-50 p-4 border-b md:border-b-0 md:border-r w-full md:w-64 flex flex-col justify-between shrink-0">
                        <div>
                            <h3 className="font-medium text-gray-900 truncate mb-1" title={uri}>
                                {uri}
                            </h3>
                            <p className="text-xs text-gray-500">View Component</p>
                        </div>
                        <button
                            onClick={() => window.navigate(uri)}
                            className="mt-4 w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Open Full View
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        {errors[uri] ? (
                            <div className="absolute inset-0 flex items-center justify-center p-4 text-red-500 text-sm text-center bg-red-50">
                                Error loading view: {errors[uri]}
                            </div>
                        ) : viewData[uri] ? (
                            <iframe
                                srcDoc={viewData[uri]}
                                className="w-full h-full border-0"
                                title={`View ${uri}`}
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
