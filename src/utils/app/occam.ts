export interface OccamDocument {
    body: string;
    description: string;
};

export const getOccamCustomContent = async (promt: string, host: string | null, account: string | null) => {
    if (host == null || host === "")
        return undefined;
    if (account == null || account === "")
        return undefined;

    const url = `${host}/public/document/userDocuments?accountId=${account}&text=${promt}`;
    const response = await fetch(url);

    if (!response.ok) {
        const serverErrorMessage = await response.text();
        console.error(`Occam documents fetch error: ${serverErrorMessage}. ${response.status}`);
        return undefined;
    }

    const documents = (await response.json()) as OccamDocument[];

    if (documents.length === 0) {
        return undefined;
    }

    return {
        custom_content: {
            attachments: documents
                .map((d) => ({
                    type: "occam",
                    title: d.description,
                    data: d.body,
                })),
        },
    };
};