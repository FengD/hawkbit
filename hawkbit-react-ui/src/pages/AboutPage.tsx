import { Card, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { env } from '../config/env';

const defaultMarkdown = `# About\n\nUpdate this text by editing the markdown file configured by \`VITE_ABOUT_MARKDOWN_PATH\`.`;

export const AboutPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(defaultMarkdown);

  useEffect(() => {
    const loadMarkdown = async () => {
      setLoading(true);
      try {
        const response = await fetch(env.aboutMarkdownPath);
        if (!response.ok) {
          throw new Error('Failed to load markdown file');
        }
        const markdown = await response.text();
        setContent(markdown || defaultMarkdown);
      } catch {
        setContent(defaultMarkdown);
      } finally {
        setLoading(false);
      }
    };

    void loadMarkdown();
  }, []);

  return (
    <Card title={<Typography.Title level={4}>{t('app.about')}</Typography.Title>}>
      {loading ? <Spin /> : <ReactMarkdown>{content}</ReactMarkdown>}
    </Card>
  );
};
