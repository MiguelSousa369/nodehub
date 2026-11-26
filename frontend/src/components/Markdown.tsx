import ReactMarkdown from 'react-markdown'

// ---------------------------------------------------------------------------
// Renders Markdown written by technicians or Claude (machine profiles).
//
// react-markdown never renders raw HTML, so text recorded from client machines can't inject markup
// or scripts into the dashboard. Links open in a new tab.
// ---------------------------------------------------------------------------

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-sm">
      <ReactMarkdown
        components={{
          a: ({ href, children: text }) => <a href={href} target="_blank" rel="noreferrer noopener">{text}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
