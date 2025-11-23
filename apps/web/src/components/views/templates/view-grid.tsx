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
                <h2 className="text-xl font-semibold mb-2">Empty Grid</h2>
                <p>No views configured. Add view URIs to the "views" prop.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {views.map((uri) => (
                <div key={uri} className="border rounded-lg overflow-hidden shadow-sm bg-white h-96 flex flex-col">
                    <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 truncate" title={uri}>
                            {uri}
                        </span>
                        <button
                            onClick={() => window.navigate(uri)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            Open
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
